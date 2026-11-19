import { expect, test, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import {
  createRoom,
  joinRoom,
  startGame,
  submitAnswer,
  tick,
  toPublic,
} from '@/online/logic'
import { questionById } from '@/game/questions'
import { Studio } from '@/components/online/Studio'
import { Lobby } from '@/components/online/Lobby'
import { OnlineFinal } from '@/components/online/OnlineFinal'
import { Avatar } from '@/components/online/Avatar'
import { AVATAR_COUNT } from '@/online/avatars'

vi.mock('@/game/confetti', () => ({ fireConfetti: () => {} }))

test('renders all phases', () => {
  let t = Date.now()
  const { state, player: host } = createRoom(
    'ABCD',
    { name: 'Ana', avatar: 3 },
    { rounds: 3, timer: 20, format: 'classic' },
    t,
  )
  const b = joinRoom(state, { name: 'Bruno', avatar: 5 }, t)
  const act = vi.fn(async () => toPublic(state, t))
  const base = { me: b.id, act, serverNow: () => Date.now() }
  render(<Lobby room={toPublic(state, t)} {...base} />)
  expect(screen.getByText('ABCD')).toBeTruthy()
  expect(screen.getByText(/Čekamo da domaćin/)).toBeTruthy()
  cleanup()
  startGame(state, host.id, t)
  render(<Studio room={toPublic(state, t)} {...base} />)
  expect(screen.getAllByText(/Na redu je/).length).toBeGreaterThan(0)
  cleanup()
  const q = questionById(state.rounds[0].questionId)!
  submitAnswer(state, host.id, q.answers[0].text, t)
  render(<Studio room={toPublic(state, t)} {...base} />)
  expect(screen.getAllByText(/odgovara/).length).toBeGreaterThan(0)
  cleanup()
  t = state.phaseUntil! + 1
  state.players.forEach((p) => (p.lastSeen = t))
  tick(state, t)
  render(<Studio room={toPublic(state, t)} {...base} />)
  expect(screen.getAllByText(/Ti si na redu/).length).toBeGreaterThan(0)
  expect(screen.getByLabelText('Tvoj odgovor')).toBeTruthy()
  cleanup()
  submitAnswer(state, b.id, 'krivo krivo', t)
  t = state.phaseUntil! + 1
  tick(state, t)
  expect(state.phase).toBe('summary')
  render(<Studio room={toPublic(state, t)} {...base} />)
  expect(screen.getByText(/Najrjeđi odgovori/)).toBeTruthy()
  cleanup()
  state.phase = 'final'
  render(<OnlineFinal room={toPublic(state, t)} {...base} me={host.id} />)
  expect(screen.getByText(/Nova igra/)).toBeTruthy()
  cleanup()
  for (let i = 0; i < AVATAR_COUNT; i++)
    for (const m of ['idle', 'thinking', 'happy', 'sad', 'neutral'] as const)
      render(<Avatar id={i} mood={m} />)
})

test('renders trio phases', async () => {
  const { lockAnswers } = await import('@/online/logic')
  const { verdictForIndex } = await import('@/game/meaning')
  const t = Date.now()
  const { state, player: host } = createRoom(
    'TRIO',
    { name: 'Ana', avatar: 3 },
    { rounds: 3, timer: 20 },
    t,
  )
  const b = joinRoom(state, { name: 'Bruno', avatar: 5 }, t)
  const act = vi.fn(async () => toPublic(state, t))
  const base = { act, serverNow: () => Date.now() }
  startGame(state, host.id, t)
  render(<Studio room={toPublic(state, t)} me={b.id} {...base} />)
  expect(screen.getByText(/Svi upisuju 3 odgovora/)).toBeTruthy()
  expect(screen.getByText('Odgovor 3')).toBeTruthy()
  cleanup()
  const q = questionById(state.rounds[0].questionId)!
  const v = (i: number) => verdictForIndex(q, i, 'baza')
  lockAnswers(
    state,
    host.id,
    [q.answers[0].text, '', ''],
    [v(0), null, null],
    t,
  )
  lockAnswers(
    state,
    b.id,
    [q.answers[0].text, q.answers[1].text, ''],
    [v(0), v(1), null],
    t,
  )
  render(<Studio room={toPublic(state, t)} me={b.id} {...base} />)
  expect(screen.getAllByText(/1\. odgovor/).length).toBeGreaterThan(0)
  cleanup()
  const t2 = state.phaseUntil! + 1
  state.players.forEach((p) => (p.lastSeen = t2))
  tick(state, t2)
  expect(state.phase).toBe('replace')
  render(<Studio room={toPublic(state, t2)} me={b.id} {...base} />)
  expect(screen.getAllByText(/već unesen u ovoj rundi/).length).toBeGreaterThan(
    0,
  )
  expect(screen.getByPlaceholderText('Zamjenski odgovor…')).toBeTruthy()
  cleanup()
})
