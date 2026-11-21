/**
 * Meaning-level answer matching that runs both in the browser and on the
 * server. Layer A of the answer judge (after the exact/alias matcher) and
 * the offline fallback when the AI judge is unavailable.
 */
import { matchAnswer, normalize } from './match'
import { isAdultCategory } from './questions'
import type { Question, Turn } from './types'

export const WRONG = 100
/** Points range for a valid answer that isn't in the list. */
export const NOVEL_MIN = 0
export const NOVEL_MAX = 20

export type JudgeSource = 'baza' | 'ai' | 'rezerva'

export interface Verdict {
  /** Matched answer in the list, or null. */
  answerIndex: number | null
  points: number
  /** Valid answer that isn't in the list (short Croatian label). */
  novel?: string
  source: JudgeSource
  /** Short explanation from the judge, shown to the players. */
  reason?: string
}

export interface Taken {
  indexes: number[]
  novels: string[]
}

/** Result of judging including duplicate detection. */
export type Judged =
  { ok: true; verdict: Verdict } | { ok: false; duplicate: string }

const STOP = new Set(
  'i a u na za s sa se je su sam si smo ste da ne li ili od do po pri iz o kod me te ga ju mu joj im ih mi ti on ona ono oni one mi vi ja to taj ta ovo ova ovaj neki neka nesto sto kad kada kako koji koja koje jer ali vec jos bas samo malo puno vrlo jako cu ces ce cemo cete bi bih bismo biste bio bila bilo biti imam ima imaju nema nisam nije nisu jesi jesam jest jesu hoces hocu hoce mozes mogu moze zelim zelis zeli daj ajde aj hajde the of and or to in on'.split(
    ' ',
  ),
)

const SUFFIXES = [
  'ovima',
  'evima',
  'anjem',
  'enjem',
  'ijama',
  'ovati',
  'ivati',
  'avati',
  'anje',
  'enje',
  'ovim',
  'ovih',
  'ama',
  'ima',
  'ati',
  'iti',
  'eti',
  'uti',
  'ovi',
  'ove',
  'ova',
  'evi',
  'nja',
  'nju',
  'om',
  'em',
  'og',
  'oj',
  'ih',
  'im',
  'is',
  'ju',
  'mo',
  'te',
  'la',
  'lo',
  'li',
  'le',
  'o',
  'a',
  'e',
  'i',
  'u',
]

/** Very small Croatian stemmer: strips common case/verb endings, keeps ≤6 chars. */
export function stem(word: string): string {
  let w = word
  for (const s of SUFFIXES) {
    if (w.length - s.length >= 3 && w.endsWith(s)) {
      w = w.slice(0, -s.length)
      break
    }
  }
  return w.slice(0, 6)
}

/** Content-word stems of a text (stop words and very short words removed). */
export function stems(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(stem)
}

const keyCache = new WeakMap<Question, string[][][]>()

/** For each answer: stem sets of its display text and each plain alias. */
function answerKeys(q: Question): string[][][] {
  const hit = keyCache.get(q)
  if (hit) return hit
  const keys = q.answers.map((a) =>
    [a.text, a.text.replace(/\(.*?\)/g, ''), ...a.alts]
      .map((t) =>
        t.startsWith('~') ? [stem(normalize(t.slice(1)))] : stems(t),
      )
      .filter((k) => k.length > 0),
  )
  keyCache.set(q, keys)
  return keys
}

const sameRoot = (a: string, b: string) =>
  a === b ||
  (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))
/**
 * Layer A meaning match:
 * - Short 2-word names (e.g. "Ivan Buljubašić") still require the surname (last word)
 *   so "Ivan" alone doesn't match.
 * - Longer descriptive answers (3+ content words, e.g. "bili su vezani povezom sa očiju...")
 *   accept any 2+ matching content words (or 1 long specific word if all typed words belong to the answer),
 *   while rejecting wrong details like "vezane ruke" when "ruke" isn't in the answer!
 */
export function matchMeaning(q: Question, input: string): number | null {
  const direct = matchAnswer(q, input)
  if (direct !== null) return direct
  const words = stems(input)
  if (!words.length) return null
  const hits = new Set<number>()

  answerKeys(q).forEach((keys, i) => {
    for (const key of keys) {
      // Svaka bitna riječ koju je igrač upisao mora postojati u točnom odgovoru (odbija "vezane ruke" ako nema ruku!)
      const allWordsMatch = words.every((w) => key.some((k) => sameRoot(w, k)))
      if (!allWordsMatch) continue

      if (key.length >= 3) {
        // Opisni odgovor (3+ ključne riječi): dovoljno je pogoditi 2+ ključne riječi (npr. "vezani povezom")
        // ili 1 specifičnu ključnu riječ od 5+ slova korijena (npr. "vezani") ako igrač nije napisao ništa pogrešno!
        const hasSpecific = words.length >= 2 || words[0].length >= 5
        if (hasSpecific) {
          hits.add(i)
          return
        }
      } else if (words.length >= 2) {
        const lastKey = key[key.length - 1]
        if (words.some((w) => sameRoot(w, lastKey))) {
          hits.add(i)
          return
        }
      } else {
        const lastKey = key[key.length - 1]
        if (key.length === 1 || sameRoot(words[0], lastKey)) {
          hits.add(i)
          return
        }
      }
    }
  })

  return hits.size === 1 ? [...hits][0] : null
}

/**
 * Strict overlap fallback: accepts when all typed words (or at least 2 of 3+ typed words
 * on long descriptive answers) match the target without conflicting details.
 */
export function matchOverlap(q: Question, input: string): number | null {
  const words = stems(input)
  if (!words.length) return null
  let best = 0
  let bestIdx: number[] = []

  answerKeys(q).forEach((keys, i) => {
    for (const key of keys) {
      const matched = words.filter((w) => key.some((k) => sameRoot(w, k))).length
      if (matched === 0) continue

      if (key.length >= 3) {
        // Kod dugih opisnih odgovora priznaje ako su sve upisane riječi točne (bar 1 duga ili 2+ riječi)
        // ili ako se poklapa barem 2 ključne riječi i većina (>= 66%) upisanog teksta
        const allOk = matched === words.length && (words.length >= 2 || words[0].length >= 5)
        const majorityOk = matched >= 2 && matched / words.length >= 0.66
        if (!allOk && !majorityOk) continue
      } else {
        if (matched < words.length) continue
        const lastKey = key[key.length - 1]
        if (key.length > 1 && !words.some((w) => sameRoot(w, lastKey))) continue
      }

      if (matched > best) {
        best = matched
        bestIdx = [i]
      } else if (matched === best && !bestIdx.includes(i)) {
        bestIdx.push(i)
      }
    }
  })

  return best > 0 && bestIdx.length === 1 ? bestIdx[0] : null
}

/** Rough "is this real words, not keyboard mashing" check. */
export function looksMeaningful(input: string): boolean {
  const n = normalize(input)
  const letters = n.replace(/[^a-z]/g, '')
  if (letters.length < 3) return false
  const words = n.split(' ').filter(Boolean)
  if (words.some((w) => /[bcdfghjklmnpqrstvwxz]{5,}/.test(w))) return false
  if (/(.)\1{3,}/.test(letters)) return false
  if (/^(asdf|qwer|yxcv|jkl|hjkl|zxcv|sdfg|dfgh)/.test(letters)) return false
  const vowels = letters.replace(/[^aeiou]/g, '').length
  return vowels / letters.length >= 0.2
}

/** Open-ended questions (18+) accept sensible answers that aren't in the list. */
export const isOpenQuestion = (q: Question) => isAdultCategory(q.category)

export function verdictForIndex(
  q: Question,
  idx: number,
  source: JudgeSource,
  reason?: string,
): Verdict {
  return { answerIndex: idx, points: q.answers[idx].points, source, reason }
}

/** Keyword/root check: only recognisable listed answers count, everything else is 100. */
export function fallbackVerdict(q: Question, input: string): Verdict {
  const idx = matchMeaning(q, input) ?? matchOverlap(q, input)
  if (idx !== null) return verdictForIndex(q, idx, 'rezerva')
  return { answerIndex: null, points: WRONG, source: 'rezerva' }
}

const exactCache = new WeakMap<Question, Map<string, number>>()

/**
 * Layer A (strict): only a 100% identical whole phrase counts — the display
 * text or one of its plain spellings, after lowercasing and removing
 * diacritics. Keyword stems, typos and partial words are left to the AI judge.
 */
export function matchExact(q: Question, input: string): number | null {
  let map = exactCache.get(q)
  if (!map) {
    map = new Map()
    const add = (raw: string, i: number) => {
      const n = normalize(raw)
      if (n && !map!.has(n)) map!.set(n, i)
    }
    q.answers.forEach((a, i) => {
      add(a.text, i)
      add(a.text.replace(/\(.*?\)/g, ''), i)
      for (const alt of a.alts) if (!alt.startsWith('~')) add(alt, i)
    })
    exactCache.set(q, map)
  }
  return map.get(normalize(input)) ?? null
}

/**
 * The answer judge (no AI, no network): exact phrase or alias first, then
 * typos, inflections and word roots. Used by local games in the browser and
 * by online rooms on the server, so both play by exactly the same rules.
 */
export function judgeOffline(q: Question, input: string, taken: Taken): Judged {
  const value = input.trim().slice(0, 80)
  const idx = matchExact(q, value)
  const v =
    idx !== null ? verdictForIndex(q, idx, 'baza') : fallbackVerdict(q, value)
  return checkDuplicate(q, v, taken)
}

/** Reject answers already used in this round (by index or by novel label). */
export function checkDuplicate(q: Question, v: Verdict, taken: Taken): Judged {
  if (v.answerIndex !== null && taken.indexes.includes(v.answerIndex))
    return { ok: false, duplicate: q.answers[v.answerIndex].text }
  if (v.novel) {
    const n = normalize(v.novel)
    const same = taken.novels.find((t) => normalize(t) === n)
    if (same) return { ok: false, duplicate: same }
  }
  return { ok: true, verdict: v }
}

/** Text to show for a turn's answer, or null for a wrong / timed-out answer. */
export function answerLabel(
  q: Question,
  t: Pick<Turn, 'answerIndex' | 'novel'>,
): string | null {
  if (t.answerIndex !== null) return q.answers[t.answerIndex]?.text ?? null
  return t.novel ?? null
}

export const isCorrect = (t: Pick<Turn, 'answerIndex' | 'novel'>) =>
  t.answerIndex !== null || !!t.novel

export const duplicateMessage = (text: string) =>
  `„${text}” je već iskorišten u ovoj rundi — pokušaj drugi odgovor.`
