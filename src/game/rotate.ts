/**
 * Anti-cheat rotation: when a question comes up again, a different rare
 * correct answer becomes the 0-point "NitkoSjet!" answer and the previous
 * 0-point answers rise to 15–25 points, so memorised answers stop paying off.
 * Deterministic per (question, variant) so server and browsers agree.
 */
import type { Question } from './types'

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic shuffle of indices seeded by a string. */
function seededOrder(indices: number[], seed: string) {
  return [...indices].sort(
    (a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`),
  )
}

/**
 * Return the question as it should be played the `variant`-th time it
 * repeats (0 = original). Returns the same object for variant 0.
 */
export function rotateQuestion(q: Question, variant = 0): Question {
  if (!variant || variant < 1) return q
  const answers = q.answers.map((a) => ({ ...a }))
  const seed = `${q.id}#${variant}`
  const zeros = answers
    .map((a, i) => (a.points === 0 ? i : -1))
    .filter((i) => i >= 0)
  const count = Math.max(1, zeros.length)
  // Prefer rare answers (1–10), then less common ones (11–20) if there are too few.
  let pool = answers
    .map((a, i) => (a.points >= 1 && a.points <= 10 ? i : -1))
    .filter((i) => i >= 0)
  if (pool.length < count)
    pool = answers
      .map((a, i) => (a.points >= 1 && a.points <= 20 ? i : -1))
      .filter((i) => i >= 0)
  if (!pool.length) return { ...q, variant }
  const fresh = seededOrder(pool, seed).slice(0, count)
  zeros.forEach((i, k) => {
    answers[i].points = 15 + (hash(`${seed}:old${k}`) % 11)
  })
  for (const i of fresh) answers[i].points = 0
  return { ...q, answers, variant }
}
