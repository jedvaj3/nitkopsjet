import { describe, expect, test } from 'vitest'
import { matchAnswer, normalize } from '@/game/match'
import sport from './sport'
import geografija from './geografija'
import film from './film'
import glazba from './glazba'
import povijest from './povijest'
import znanost from './znanost'
import hrvatska from './hrvatska'
import opca from './opca'

const FILES = {
  sport,
  geografija,
  film,
  glazba,
  povijest,
  znanost,
  hrvatska,
  opca,
}

describe.each(Object.entries(FILES))('extra file %s', (name, list) => {
  test('has 50–100 questions', () => {
    expect(list.length).toBeGreaterThanOrEqual(50)
    expect(list.length).toBeLessThanOrEqual(100)
  })
  test.each(list.map((q) => [q.id, q] as const))('%s', (_id, q) => {
    expect(q.category).toBe(name)
    expect(q.answers.length, 'answers 12–30').toBeGreaterThanOrEqual(12)
    expect(q.answers.length, 'answers 12–30').toBeLessThanOrEqual(30)
    expect(
      q.answers.filter((a) => a.points <= 5).length,
      'at least two answers ≤5',
    ).toBeGreaterThanOrEqual(2)
    expect(
      Math.max(...q.answers.map((a) => a.points)),
      'top answer ≥ 60',
    ).toBeGreaterThanOrEqual(60)
    const stems = new Map<string, string>()
    q.answers.forEach((a, i) => {
      expect(a.points, a.text).toBeGreaterThanOrEqual(0)
      expect(a.points, a.text).toBeLessThanOrEqual(100)
      for (const alt of a.alts) {
        if (!alt.startsWith('~')) continue
        const s = normalize(alt.slice(1))
        expect(
          s.length,
          `${a.text}: stem "${alt}" too short`,
        ).toBeGreaterThanOrEqual(3)
        const owner = stems.get(s)
        expect(
          owner === undefined || owner === a.text,
          `stem "${alt}" shared`,
        ).toBe(true)
        stems.set(s, a.text)
      }
      expect(matchAnswer(q, a.text), `"${a.text}" must match itself`).toBe(i)
    })
    const texts = q.answers.map((a) => normalize(a.text))
    expect(new Set(texts).size, 'duplicate answers').toBe(texts.length)
  })
})
