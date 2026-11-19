import { describe, expect, test } from 'vitest'
import { matchAnswer, normalize } from '@/game/match'
import klasici from './pitanja18_klasici'
import seks from './pitanja18_seks'
import izlasci from './pitanja18_izlasci_alkohol'
import fetisi from './pitanja18_fetisi_tabu'
import veze from './pitanja18_veze_prevare'
import sramota from './pitanja18_sramotne_situacije'
import novo1 from './pitanja18_novo1'
import novo2 from './pitanja18_novo2'
import { QUESTIONS } from '@/game/questions'

const FILES = { klasici, seks, izlasci, fetisi, veze, sramota, novo1, novo2 }

describe.each(Object.entries(FILES))('18+ file %s', (_name, list) => {
  test.each(list.map((q) => [q.id, q] as const))('%s', (_id, q) => {
    expect(q.category).toBe('odrasli')
    expect(q.answers.length, 'answers 15–20').toBeGreaterThanOrEqual(15)
    expect(q.answers.length, 'answers 15–20').toBeLessThanOrEqual(21)
    expect(
      q.answers.filter((a) => a.points <= 5).length,
      'at least two answers ≤5 points',
    ).toBeGreaterThanOrEqual(2)
    expect(
      Math.max(...q.answers.map((a) => a.points)),
      'top answer ≥ 60',
    ).toBeGreaterThanOrEqual(60)
    const stems = new Map<string, string>()
    q.answers.forEach((a, i) => {
      expect(a.points, a.text).toBeGreaterThanOrEqual(0)
      expect(a.points, a.text).toBeLessThanOrEqual(100)
      expect(a.alts.length, `${a.text}: 4–6 aliases`).toBeGreaterThanOrEqual(4)
      expect(a.alts.length, `${a.text}: 4–6 aliases`).toBeLessThanOrEqual(8)
      for (const alt of a.alts) {
        if (!alt.startsWith('~')) continue
        const s = normalize(alt.slice(1))
        expect(
          s.length,
          `${a.text}: stem "${alt}" too short (min 3)`,
        ).toBeGreaterThanOrEqual(3)
        const owner = stems.get(s)
        expect(
          owner === undefined || owner === a.text,
          `stem "${alt}" used by "${owner}" and "${a.text}"`,
        ).toBe(true)
        stems.set(s, a.text)
      }
      // The display text must resolve to its own answer.
      expect(matchAnswer(q, a.text), `"${a.text}" must match itself`).toBe(i)
    })
    const texts = q.answers.map((a) => normalize(a.text))
    expect(new Set(texts).size, 'duplicate answers').toBe(texts.length)
  })
})

test('ids and question texts are unique', () => {
  const ids = QUESTIONS.map((q) => q.id)
  expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
  const texts = QUESTIONS.map((q) => normalize(q.text))
  expect(texts.filter((t, i) => texts.indexOf(t) !== i)).toEqual([])
})

test('18+ total is 200–350', () => {
  const n = Object.values(FILES).reduce((s, l) => s + l.length, 0)
  console.log('18+ questions:', n)
  expect(n).toBeGreaterThanOrEqual(200)
  expect(n).toBeLessThanOrEqual(350)
})
