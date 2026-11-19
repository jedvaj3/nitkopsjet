import { expect, test } from 'vitest'
import { questionById } from '@/game/questions'
import { verdictForIndex } from '@/game/meaning'
import {
  createRoom,
  joinRoom,
  lockAnswers,
  replaceAnswer,
  startGame,
  tick,
  toPublic,
  RoomError,
} from './logic'

test('trio round: lock, round-robin reveal, duplicate replacement, totals', () => {
  let t = 1_000_000
  const { state, player: a } = createRoom(
    'TRIO',
    { name: 'Miško', avatar: 0 },
    { rounds: 3, timer: 30 },
    t,
  )
  expect(state.settings.format).toBe('trio')
  const b = joinRoom(state, { name: 'Patrik', avatar: 1 }, t)
  startGame(state, a.id, t)
  expect(state.phase).toBe('input')
  expect(state.deadline).toBe(t + 60_000)
  const q = questionById(state.rounds[0].questionId)!
  const v = (i: number) => verdictForIndex(q, i, 'baza')
  // own duplicate is rejected
  expect(() =>
    lockAnswers(state, a.id, ['x', 'y', 'z'], [v(0), v(0), null], t),
  ).toThrow('Već si upisao')
  lockAnswers(
    state,
    a.id,
    [q.answers[0].text, q.answers[1].text, ''],
    [v(0), v(1), null],
    t,
  )
  expect(state.phase).toBe('input')
  expect(toPublic(state, t).locked).toEqual([a.id])
  // public view does not leak locked answers
  expect(JSON.stringify(toPublic(state, t))).not.toContain(q.answers[1].text)
  // b repeats a's first answer in slot 0 and a's second in slot 1
  lockAnswers(
    state,
    b.id,
    [q.answers[0].text, q.answers[2].text, q.answers[3].text],
    [v(0), v(2), v(3)],
    t,
  )
  // reveal order: a0, b0 (dup!), a1, b1, a2, b2
  expect(state.phase).toBe('reveal')
  expect(toPublic(state, t).currentPlayerId).toBe(a.id)
  expect(toPublic(state, t).revealSlot).toBe(0)
  t = state.phaseUntil! + 1
  state.players.forEach((p) => (p.lastSeen = t))
  tick(state, t)
  expect(state.phase).toBe('replace')
  let pub = toPublic(state, t)
  expect(pub.replacing).toMatchObject({
    playerId: b.id,
    slot: 0,
    duplicate: q.answers[0].text,
  })
  expect(pub.currentPlayerId).toBe(b.id)
  // replacement that repeats own slot-1 answer is rejected, then a fresh one is accepted
  expect(() =>
    replaceAnswer(state, b.id, 'x', t, { ok: true, verdict: v(2) }),
  ).toThrow(RoomError)
  replaceAnswer(state, b.id, q.answers[4].text, t, { ok: true, verdict: v(4) })
  expect(state.phase).toBe('reveal')
  for (let i = 0; i < 10 && state.phase !== 'summary'; i++) {
    t = state.phaseUntil! + 1
    state.players.forEach((p) => (p.lastSeen = t))
    tick(state, t)
  }
  expect(state.phase).toBe('summary')
  const turns = state.rounds[0].turns
  expect(turns.map((x) => [x.playerId === a.id ? 'a' : 'b', x.slot])).toEqual([
    ['a', 0],
    ['b', 0],
    ['a', 1],
    ['b', 1],
    ['a', 2],
    ['b', 2],
  ])
  pub = toPublic(state, t)
  const pts = (i: number) => q.answers[i].points
  expect(pub.players.find((p) => p.id === a.id)!.total).toBe(
    pts(0) + pts(1) + 100,
  )
  expect(pub.players.find((p) => p.id === b.id)!.total).toBe(
    pts(4) + pts(2) + pts(3),
  )
})

test('trio: input timeout locks blanks, replace timeout gives 100', () => {
  let t = 5_000_000
  const { state, player: a } = createRoom(
    'TRI2',
    { name: 'Ana', avatar: 0 },
    { rounds: 3, timer: 20 },
    t,
  )
  const b = joinRoom(state, { name: 'Ivo', avatar: 1 }, t)
  startGame(state, a.id, t)
  const q = questionById(state.rounds[0].questionId)!
  const v = (i: number) => verdictForIndex(q, i, 'baza')
  lockAnswers(state, a.id, [q.answers[0].text, '', ''], [v(0), null, null], t)
  t = state.deadline! + 10_001
  state.players.forEach((p) => (p.lastSeen = t))
  tick(state, t)
  expect(state.phase).toBe('reveal')
  expect(state.rounds[0].entries![b.id].every((e) => e.points === 100)).toBe(
    true,
  )
})

test('classic format still works', () => {
  const t = 9_000_000
  const { state, player: a } = createRoom(
    'CLAS',
    { name: 'Ana', avatar: 0 },
    { rounds: 3, timer: 20, format: 'classic' },
    t,
  )
  startGame(state, a.id, t)
  expect(state.phase).toBe('turn')
})

test('reactions: only at whoever is on turn, rate-limited, expire', async () => {
  const { react } = await import('./logic')
  const t = 20_000_000
  const { state, player: a } = createRoom(
    'REAC',
    { name: 'Ana', avatar: 0 },
    { rounds: 3, timer: 20, format: 'classic' },
    t,
  )
  const b = joinRoom(state, { name: 'Ivo', avatar: 1 }, t)
  expect(() => react(state, b.id, '😂', t)).toThrow() // lobby
  startGame(state, a.id, t)
  expect(() => react(state, a.id, '😂', t)).toThrow('sam/a na sebe')
  expect(() => react(state, b.id, '🍆', t)).toThrow('Nepoznata')
  react(state, b.id, '😂', t)
  expect(() => react(state, b.id, '🔥', t + 100)).toThrow()
  react(state, b.id, '🔥', t + 700)
  expect(
    toPublic(state, t + 800).reactions.map((r) => [r.emoji, r.to]),
  ).toEqual([
    ['😂', a.id],
    ['🔥', a.id],
  ])
  expect(toPublic(state, t + 12_000).reactions).toEqual([])
})

test('reactions queued between polls are applied in one batch', async () => {
  const { reactBatch } = await import('./logic')
  const t = 30_000_000
  const { state, player: a } = createRoom(
    'REAB',
    { name: 'Ana', avatar: 0 },
    { rounds: 3, timer: 20, format: 'classic' },
    t,
  )
  const b = joinRoom(state, { name: 'Ivo', avatar: 1 }, t)
  startGame(state, a.id, t)
  expect(reactBatch(state, b.id, ['😂', '🔥', 'xx'], t)).toBe(true)
  expect(toPublic(state, t).reactions.map((r) => r.emoji)).toEqual(['😂', '🔥'])
  expect(reactBatch(state, a.id, ['😂'], t)).toBe(false)
})
