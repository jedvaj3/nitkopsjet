import { expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { verdictForIndex } from '@/game/meaning'
import { QUESTIONS } from '@/game/questions'
import type { GameConfig } from '@/game/types'
import { TrioFields } from './TrioFields'
import { TrioReveal } from './TrioReveal'

vi.mock('@/game/confetti', () => ({ fireConfetti: () => {} }))
vi.mock('@/game/sound', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }))
// Make the score column finish instantly.
vi.mock('./ScoreColumn', () => ({
  ScoreColumn: ({ onDone }: { onDone?: () => void }) => {
    setTimeout(() => onDone?.(), 0)
    return <div>column</div>
  },
}))

const q = QUESTIONS.find((x) => x.id === 'hr-olimpijci')!

test('own duplicate warning while typing', () => {
  render(
    <TrioFields question={q} onLock={async () => null} secondsLeft={null} />,
  )
  const [a, b] = screen.getAllByRole('textbox')
  fireEvent.change(a, { target: { value: 'Janica Kostelić' } })
  fireEvent.change(b, { target: { value: 'janica' } })
  expect(screen.getByRole('alert').textContent).toContain(
    'Već si upisao taj odgovor',
  )
})

test('round-robin reveal with duplicate replacement prompt', async () => {
  const config: GameConfig = {
    mode: 'duel',
    category: 'sport',
    timer: 0,
    players: ['Miško', 'Patrik'],
    format: 'trio',
  }
  const v = (i: number) => verdictForIndex(q, i, 'baza')
  const onDone = vi.fn()
  render(
    <TrioReveal
      question={q}
      config={config}
      order={[0, 1]}
      entries={{
        0: {
          inputs: [q.answers[0].text, '', ''],
          verdicts: [v(0), null, null],
        },
        1: {
          inputs: [q.answers[0].text, q.answers[1].text, ''],
          verdicts: [v(0), v(1), null],
        },
      }}
      roundNumber={1}
      totalRounds={3}
      onDone={onDone}
    />,
  )
  await act(async () => {})
  expect(screen.getAllByText(/Miško · 1\. odgovor/).length).toBe(1)
  fireEvent.click(await screen.findByText('Sljedeći odgovor'))
  await act(async () => {})
  // Patrik's 1st answer repeats Miško's → no penalty, replacement prompt
  expect(
    screen.getByText(/Ovaj odgovor je već unesen u ovoj rundi/),
  ).toBeTruthy()
  expect(screen.getByLabelText('Zamjenski odgovor')).toBeTruthy()
})
