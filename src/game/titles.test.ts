import { expect, test } from 'vitest'
import { assignTitles, podiumShareText } from './titles'

const t = (
  points: number,
  extra: Partial<{
    correct: boolean
    adult: boolean
    ms: number
    novel: boolean
  }> = {},
) => ({
  points,
  correct: points < 100,
  adult: false,
  ...extra,
})

test('every player gets one distinct, fitting title', () => {
  const titles = assignTitles([
    {
      id: 'a',
      name: 'Miško',
      turns: [t(0, { ms: 4000 }), t(12, { ms: 5000 }), t(30, { ms: 6000 })],
    },
    {
      id: 'b',
      name: 'Patrik',
      turns: [
        t(100, { ms: 20000 }),
        t(100, { ms: 25000 }),
        t(40, { ms: 22000 }),
      ],
    },
    {
      id: 'c',
      name: 'Ana',
      turns: [t(80, { ms: 9000 }), t(75, { ms: 9000 }), t(90, { ms: 9000 })],
    },
    {
      id: 'd',
      name: 'Iva',
      turns: [
        t(20, { adult: true, ms: 8000 }),
        t(25, { adult: true, ms: 8000 }),
        t(60, { ms: 9000 }),
      ],
    },
  ])
  expect(titles.a.name).toBe('Srećković')
  expect(titles.b.name).toBe('Magnet za stotke')
  expect(titles.c.name).toBe('Hodajući zicer')
  expect(titles.d.name).toBe('Kralj 18+ zone')
  expect(new Set(Object.values(titles).map((x) => x.name)).size).toBe(4)
})

test('slowest player is the eternal philosopher when nothing else stands out', () => {
  const titles = assignTitles([
    { id: 'a', name: 'A', turns: [t(40, { ms: 30000 }), t(45, { ms: 28000 })] },
    { id: 'b', name: 'B', turns: [t(40, { ms: 3000 }), t(45, { ms: 4000 })] },
  ])
  expect(titles.a.name).toBe('Vječni filozof')
  expect(titles.b.name).toBe('Munja')
})

test('share text has medals, totals and titles', () => {
  const text = podiumShareText(
    'NitkoSjet',
    [
      {
        id: 'a',
        name: 'Ana',
        total: 42,
        place: 1,
        title: { emoji: '🍀', name: 'Srećković', text: '' },
      },
      { id: 'b', name: 'Ivo', total: 90, place: 2 },
    ],
    ['link'],
  )
  expect(text).toContain('🥇 Ana — 42')
  expect(text).toContain('🍀 Srećković')
  expect(text).toContain('🥈 Ivo — 90')
})
