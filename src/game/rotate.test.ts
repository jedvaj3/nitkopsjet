import { expect, test } from 'vitest'
import { QUESTIONS } from './questions'
import { rotateQuestion } from './rotate'

test('variant 0 is the original', () => {
  const q = QUESTIONS[0]
  expect(rotateQuestion(q, 0)).toBe(q)
})

test('repeats move the 0-point answer to another rare answer', () => {
  for (const q of QUESTIONS.slice(0, 120)) {
    const zeros = q.answers.filter((a) => a.points === 0).map((a) => a.text)
    if (!zeros.length) continue
    for (const v of [1, 2, 3]) {
      const r = rotateQuestion(q, v)
      expect(r.variant).toBe(v)
      expect(r.answers.map((a) => a.text)).toEqual(q.answers.map((a) => a.text))
      const newZeros = r.answers
        .filter((a) => a.points === 0)
        .map((a) => a.text)
      if (q.answers.some((a) => a.points >= 1 && a.points <= 20)) {
        expect(newZeros.length).toBeGreaterThan(0)
        // none of the old zero answers is still worth 0, they're now 15–25
        for (const z of zeros) {
          const p = r.answers.find((a) => a.text === z)!.points
          expect(p).toBeGreaterThanOrEqual(15)
          expect(p).toBeLessThanOrEqual(25)
        }
      }
      expect(rotateQuestion(q, v)).toEqual(r) // deterministic
    }
    expect(q.answers.filter((a) => a.points === 0).map((a) => a.text)).toEqual(
      zeros,
    ) // original untouched
  }
})
