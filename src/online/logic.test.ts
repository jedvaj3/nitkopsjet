import { expect, test } from 'vitest'
import { matchAnswer } from '@/game/match'
import { questionById, QUESTIONS } from '@/game/questions'
import { pickQuestions } from '@/game/engine'
import {
  createRoom,
  joinRoom,
  startGame,
  submitAnswer,
  tick,
  toPublic,
  nextRound,
  leaveRoom,
  RoomError,
  touch,
} from '@/online/logic'

test('adult matching', () => {
  const q = questionById('x-izgovori-seks')!
  const m = (s: string) =>
    matchAnswer(q, s) === null ? null : q.answers[matchAnswer(q, s)!].text
  expect(m('boli me glava')).toBe('Boli me glava')
  expect(m('Glavobolja')).toBe('Boli me glava')
  expect(m('umorna sam')).toBe('Umoran/umorna sam')
  expect(m('imam menstruaciju')).toBe('Imam menstruaciju')
  expect(m('banana')).toBe(null)
  const p = questionById('x-poze')!
  expect(p.answers[matchAnswer(p, 'doggy')!].text).toBe('Pseća')
  expect(p.answers[matchAnswer(p, 'obrnuta kaubojka')!].text).toBe(
    'Obrnuta kaubojka',
  )
  expect(p.answers[matchAnswer(p, '69')!].text).toBe('69')
  // existing questions still match
  const og = QUESTIONS.find((x) => x.id === 'hr-olimpijci')!
  expect(matchAnswer(og, 'janica')).not.toBe(null)
})

test('adult never in mix', () => {
  for (let i = 0; i < 50; i++) {
    const qs = pickQuestions({
      mode: 'solo',
      category: 'mix',
      timer: 0,
      players: ['x'],
    })
    expect(qs.every((q) => q.category !== 'odrasli')).toBe(true)
  }
  const a = QUESTIONS.filter((q) => q.category === 'odrasli')
  expect(a.length).toBeGreaterThanOrEqual(15)
  for (const q of a) {
    expect(q.answers.length).toBeGreaterThanOrEqual(15)
    expect(
      q.answers.filter((x) => x.points <= 5).length,
    ).toBeGreaterThanOrEqual(2)
  }
})

test('stem ambiguity report', () => {
  // each answer's own display text must match itself
  for (const q of QUESTIONS.filter((q) => q.category === 'odrasli'))
    q.answers.forEach((a, i) =>
      expect([q.id, matchAnswer(q, a.text)]).toEqual([q.id, i]),
    )
})

test('room flow', () => {
  let t = 1_000_000
  const { state, player: host } = createRoom(
    'ABCD',
    { name: 'Ana', avatar: 3 },
    { categories: ['odrasli'], rounds: 3, timer: 20, format: 'classic' },
    t,
  )
  const b = joinRoom(state, { name: 'ana', avatar: 1 }, t)
  expect(b.name).toBe('ana 2')
  const c = joinRoom(state, { name: 'Ivo', avatar: 2 }, t)
  expect(() => startGame(state, b.id, t)).toThrow(RoomError)
  startGame(state, host.id, t)
  expect(state.rounds).toHaveLength(3)
  expect(
    state.rounds.every(
      (r) => questionById(r.questionId)!.category === 'odrasli',
    ),
  ).toBe(true)
  let pub = toPublic(state, t)
  expect(pub.phase).toBe('turn')
  expect(pub.currentPlayerId).toBe(host.id)
  expect(pub.rounds[0].answers).toBeUndefined()
  expect(JSON.stringify(pub)).not.toContain(host.token)
  expect(() => submitAnswer(state, b.id, 'x', t)).toThrow('Nisi na redu.')
  const q = questionById(state.rounds[0].questionId)!
  submitAnswer(state, host.id, q.answers[0].text, t)
  expect(state.phase).toBe('reveal')
  expect(toPublic(state, t).lastTurn!.answerText).toBe(q.answers[0].text)
  // repeat answer rejected after reveal
  t = state.phaseUntil! + 1
  ;[host, b, c].forEach((p) => touch(state, p.id, t))
  tick(state, t)
  expect(state.phase).toBe('turn')
  expect(toPublic(state, t).currentPlayerId).toBe(b.id)
  expect(() => submitAnswer(state, b.id, q.answers[0].text, t)).toThrow(
    'već iskorišten',
  )
  submitAnswer(state, b.id, 'asdfghjk', t)
  expect(state.rounds[0].turns[1].points).toBe(100)
  t = state.phaseUntil! + 1
  ;[host, b, c].forEach((p) => touch(state, p.id, t))
  tick(state, t)
  // c times out
  t = state.deadline! + 1
  tick(state, t)
  expect(state.rounds[0].turns[2].timedOut).toBe(true)
  t = state.phaseUntil! + 1
  tick(state, t)
  expect(state.phase).toBe('summary')
  pub = toPublic(state, t)
  expect(pub.rounds[0].answers!.length).toBe(q.answers.length)
  nextRound(state, host.id, t)
  expect(state.roundIdx).toBe(1)
  expect(toPublic(state, t).currentPlayerId).toBe(b.id) // rotation
  // b leaves during own turn → skipped
  leaveRoom(state, b.id, t)
  expect(toPublic(state, t).currentPlayerId).toBe(c.id)
  // everyone goes silent: auto-skips & summary auto-advance till final
  for (let i = 0; i < 40 && state.phase !== 'final'; i++) {
    t += 31_000
    ;[host, c].forEach(
      (p) => (state.players.find((x) => x.id === p.id)!.lastSeen = t),
    )
    tick(state, t)
  }
  expect(state.phase).toBe('final')
  pub = toPublic(state, t)
  expect(pub.players.find((p) => p.id === host.id)!.total).toBeGreaterThan(0)
  startGame(state, host.id, t)
  expect(state.game).toBe(2)
  expect(toPublic(state, t).players.every((p) => p.total === 0)).toBe(true)
})
