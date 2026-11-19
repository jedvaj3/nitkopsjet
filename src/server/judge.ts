/**
 * AI answer judge (server only). Layer B: when the answer list can't place
 * the player's input, an LLM through Netlify AI Gateway decides whether it
 * means the same as a listed answer, is a valid unlisted answer, or is wrong.
 */
import Anthropic from '@anthropic-ai/sdk'
import { normalize } from '@/game/match'
import {
  NOVEL_MAX,
  NOVEL_MIN,
  WRONG,
  checkDuplicate,
  fallbackVerdict,
  isOpenQuestion,
  matchExact,
  verdictForIndex,
  type Judged,
  type Taken,
  type Verdict,
} from '@/game/meaning'
import type { Question } from '@/game/types'

const MODEL = 'claude-haiku-5-5'
const TIMEOUT_MS = 7000

let client: Anthropic | null = null
const ai = () =>
  (client ??= new Anthropic({ maxRetries: 0, timeout: TIMEOUT_MS }))

/** Small in-memory cache so the same input for the same question isn't judged twice. */
const cache = new Map<string, Verdict>()
const CACHE_MAX = 3000

const SYSTEM = `Ti si STROG i objektivan sudac u hrvatskom TV kvizu "NitkoSjet" (u stilu kviza "Tog se nitko nije sjetio" / Pointless). Igrači su odrasli; pitanja mogu biti bezobrazna, seksualna i vulgarna — to je normalno, ocjenjuj bez moraliziranja, ali i bez popuštanja.
Za svako pitanje postoji popis odgovora iz ankete sa 100 ljudi, s bodovima. Igrač je upisao svoj odgovor (može sadržavati sleng, zatipke, padeže, bez kvačica).
Gledaj smisao CIJELOG odgovora, a ne pojedinačne riječi. Jedna zajednička riječ s odgovorom s popisa NIJE dovoljna.
Pravila:
1. "match": ako igračev odgovor u punom smislu znači isto što i neki odgovor s popisa — sinonim, pravi hrvatski sleng, drugi padež/glagolski oblik ili zatipka (npr. "pjevaju pjesmu" = "Pjevaju", "drkanje" = "Masturbacija", "umjetni kurac" = "Dildo", "zelim seks" = "Dođi na seks") — vrati broj tog odgovora.
2. "valid": true bez matcha SAMO ako je odgovor stvaran, logičan pojam, činjenica ili pravi sleng iz stvarnog života koji u punom smislu odgovara na pitanje, a nema ga na popisu. Tada "points" 0–20 (0–5 rijedak, 6–15 srednje čest, do 20 čest) i kratak uredni "label" (2–6 riječi). Ne izmišljaj opravdanja i ne tumači odgovor "na silu" — ako moraš razmišljati kako bi to moglo imati smisla, odgovor je netočan.
3. "valid": false (100 kaznenih bodova) za:
   - obično osobno ime ili nadimak osobe (npr. "Patrik", "Marko", "Ana") kad pitanje ne traži imena ili to ime nije točan odgovor s popisa;
   - trolanje, šale i uvrede koje ne odgovaraju na pitanje (npr. "jebe me mama" na pitanje o izgovorima), vulgarnosti bez veze s pitanjem;
   - besmislice, nasumična slova, previše općenite ili nejasne odgovore;
   - činjenično netočne odgovore.
Kod činjeničnih pitanja sa zatvorenim popisom (npr. glavni gradovi, članice EU, dobitnici nagrada) popis je potpun: odgovor koji nije na popisu je netočan, osim ako je zaista, provjerljivo činjenično točan.
Odgovori ISKLJUČIVO JSON objektom bez ikakvog drugog teksta: {"match": broj ili null, "valid": true/false, "points": broj, "label": "tekst", "reason": "kratko objašnjenje na hrvatskom, najviše 12 riječi"}`

function prompt(q: Question, input: string) {
  const list = q.answers
    .map((a, i) => `${i}. ${a.text} (${a.points})`)
    .join('\n')
  return `Pitanje: ${q.text}${q.hint ? `\nNapomena: ${q.hint}` : ''}
Vrsta pitanja: ${isOpenQuestion(q) ? 'otvoreno (samo stvarni, potpuno smisleni odgovori izvan popisa mogu proći)' : 'činjenično (popis je potpun)'}
Odgovori iz ankete:
${list}

Igračev odgovor: "${input.replace(/"/g, "'")}"`
}

interface AiReply {
  match?: number | null
  valid?: boolean
  points?: number
  label?: string
  reason?: string
}

function parse(q: Question, text: string): Verdict | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  let r: AiReply
  try {
    if (!json) throw new Error('no json')
    r = JSON.parse(json) as AiReply
  } catch {
    // A reply cut off mid-"reason" still tells us the verdict.
    const m = text.match(/"match"\s*:\s*(\d+|null)/)
    const valid = text.match(/"valid"\s*:\s*(true|false)/)
    if (!m) return null
    r = {
      match: m[1] === 'null' ? null : Number(m[1]),
      valid: valid ? valid[1] === 'true' : undefined,
    }
    if (r.match === null && r.valid !== false) return null
  }
  const reason =
    typeof r.reason === 'string' ? r.reason.slice(0, 120) : undefined
  if (
    typeof r.match === 'number' &&
    Number.isInteger(r.match) &&
    q.answers[r.match]
  )
    return verdictForIndex(q, r.match, 'ai', reason)
  if (r.valid === true) {
    const points = Math.round(
      Math.min(NOVEL_MAX, Math.max(NOVEL_MIN, Number(r.points) || 5)),
    )
    const label = (typeof r.label === 'string' && r.label.trim()) || ''
    if (!label) return null
    return {
      answerIndex: null,
      points,
      novel: label.slice(0, 60),
      source: 'ai',
      reason,
    }
  }
  if (r.valid === false)
    return { answerIndex: null, points: WRONG, source: 'ai', reason }
  return null
}

async function askAi(q: Question, input: string): Promise<Verdict | null> {
  // Points depend on the anti-cheat rotation, so the variant is part of the key.
  const key = `${q.id}|${q.variant ?? 0}|${normalize(input)}`
  const hit = cache.get(key)
  if (hit) return hit
  try {
    const msg = await ai().messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt(q, input) }],
    })
    const text = msg.content
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('')
    const v = parse(q, text)
    if (v) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
      cache.set(key, v)
    } else console.warn('AI judge: unparseable reply', text.slice(0, 200))
    return v
  } catch (e) {
    console.warn('AI judge failed, using fallback:', (e as Error).message)
    return null
  }
}

/**
 * Two-layer judge: A) answer list incl. aliases, roots and typos;
 * B) the AI judge; and an offline keyword fallback if B fails.
 */
export async function judgeAnswer(
  q: Question,
  input: string,
  taken: Taken,
): Promise<Judged> {
  const value = input.trim().slice(0, 80)
  const idx = matchExact(q, value)
  if (idx !== null)
    return checkDuplicate(q, verdictForIndex(q, idx, 'baza'), taken)
  const v = (await askAi(q, value)) ?? fallbackVerdict(q, value)
  return checkDuplicate(q, v, taken)
}
