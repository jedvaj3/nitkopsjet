import type { Question } from './types'

/** Lowercase, strip diacritics (č ć ž š đ å ö …), punctuation and extra spaces. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/&/g, ' i ')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const compact = (s: string) => s.replace(/ /g, '')

function stripPrefix(s: string) {
  return s.replace(/^(the|a|an|grad|otok|rijeka|nk|fc|ac) /, '')
}

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      rowMin = Math.min(rowMin, cur[j])
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/** Typos allowed in one word: 2 from 7 letters, 1 from 4, none below. */
const typosFor = (len: number) => (len >= 7 ? 2 : len >= 4 ? 1 : 0)

/**
 * Word-by-word typo distance between two phrases with the same number of
 * words: every word must be within its own allowance (up to 2 per word).
 * Returns Infinity when the phrases don't line up.
 */
function wordwiseDistance(a: string, b: string): number {
  const wa = a.split(' ')
  const wb = b.split(' ')
  if (wa.length < 2 || wa.length !== wb.length) return Infinity
  let total = 0
  for (let i = 0; i < wa.length; i++) {
    const max = typosFor(Math.min(wa[i].length, wb[i].length))
    const d = levenshtein(wa[i], wb[i], max)
    if (d > max) return Infinity
    total += d
  }
  return total
}

type KeyIndex = { key: string; answer: number }[]
const cache = new WeakMap<Question, KeyIndex>()
const stemCache = new WeakMap<Question, { stem: string; answer: number }[]>()

/** `~stem` alternatives (see `q.ts`), normalized. */
function stemsFor(question: Question) {
  const cached = stemCache.get(question)
  if (cached) return cached
  const stems: { stem: string; answer: number }[] = []
  question.answers.forEach((a, i) => {
    for (const alt of a.alts) {
      if (!alt.startsWith('~')) continue
      const stem = normalize(alt.slice(1))
      if (stem) stems.push({ stem, answer: i })
    }
  })
  stemCache.set(question, stems)
  return stems
}

/** Answers whose keyword stems appear in the input (word prefix or phrase). */
function stemMatches(question: Question, n: string): Set<number> {
  const words = n.split(' ')
  const padded = ` ${n} `
  const hits = new Set<number>()
  for (const { stem, answer } of stemsFor(question)) {
    const hit = stem.includes(' ')
      ? padded.includes(` ${stem}`)
      : words.some((w) => w.startsWith(stem))
    if (hit) hits.add(answer)
  }
  return hits
}

function buildIndex(question: Question): KeyIndex {
  const cached = cache.get(question)
  if (cached) return cached

  const keys: KeyIndex = []
  const add = (raw: string, answer: number) => {
    const n = normalize(raw)
    if (!n) return
    for (const k of new Set([n, stripPrefix(n)])) keys.push({ key: k, answer })
  }

  question.answers.forEach((a, i) => {
    add(a.text, i)
    add(a.text.replace(/\(.*?\)/g, ''), i)
    a.alts.forEach((alt) => {
      if (!alt.startsWith('~')) add(alt, i)
    })
  })

  if (question.surnames) {
    const counts = new Map<string, number[]>()
    question.answers.forEach((a, i) => {
      const parts = normalize(a.text).split(' ')
      const last = parts[parts.length - 1]
      if (parts.length > 1 && last.length >= 3) {
        counts.set(last, [...(counts.get(last) ?? []), i])
      }
    })
    for (const [surname, idxs] of counts) {
      if (idxs.length === 1) keys.push({ key: surname, answer: idxs[0] })
    }
  }

  cache.set(question, keys)
  return keys
}

/**
 * Find which correct answer (if any) the player's input refers to.
 * Tolerant to case, diacritics, spacing and small typos.
 */
export function matchAnswer(question: Question, input: string): number | null {
  const n = stripPrefix(normalize(input))
  if (!n) return null
  const keys = buildIndex(question)

  const exact = keys.find((k) => k.key === n)
  if (exact) return exact.answer

  const c = compact(n)
  const compactHit = keys.find((k) => compact(k.key) === c)
  if (compactHit) return compactHit.answer

  // Fuzzy: allow small typos (up to 2 per word on longer words), but only
  // if the input points to exactly one answer.
  let best = Infinity
  let bestAnswers = new Set<number>()
  for (const k of c.length < 4 ? [] : keys) {
    const kc = compact(k.key)
    if (kc.length < 4) continue
    const allowed = typosFor(kc.length)
    const whole = levenshtein(c, kc, allowed)
    const d = Math.min(
      whole > allowed ? Infinity : whole,
      wordwiseDistance(n, k.key),
    )
    if (d === Infinity) continue
    if (d < best) {
      best = d
      bestAnswers = new Set([k.answer])
    } else if (d === best) {
      bestAnswers.add(k.answer)
    }
  }
  if (bestAnswers.size === 1) return [...bestAnswers][0]

  // Keyword stems: accept free-text phrasing when it points to exactly one answer.
  const stemHits = stemMatches(question, normalize(input))
  if (stemHits.size === 1) return [...stemHits][0]
  return null
}
