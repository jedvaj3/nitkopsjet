import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import {
  RoomError,
  createRoom,
  joinRoom,
  leaveRoom,
  nextRound,
  react,
  pendingJudgement,
  pendingLock,
  pendingReplace,
  lockAnswers,
  replaceAnswer,
  requirePlayer,
  startGame,
  submitAnswer,
  tick,
  toPublic,
  touch,
  updateProfile,
  updateSettings,
} from '@/online/logic'
import { insertRoom, mutateRoom, readRoom } from '@/online/server'
import { judgeAnswer } from '@/server/judge'
import type { Judged, Verdict } from '@/game/meaning'

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,6}$/)
const profile = {
  name: z.string().max(40),
  avatar: z.number().int().min(0).max(99),
}
const settings = z
  .object({
    categories: z.array(z.string().max(20)).max(20).optional(),
    rounds: z.number().int().optional(),
    timer: z.number().int().optional(),
    format: z.enum(['trio', 'classic']).optional(),
  })
  .partial()
const auth = { code, playerId: z.string().max(64), token: z.string().max(64) }

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), ...profile, settings }),
  z.object({ action: z.literal('join'), code, ...profile }),
  z.object({ action: z.literal('start'), ...auth }),
  z.object({
    action: z.literal('answer'),
    ...auth,
    input: z.string().max(120),
  }),
  z.object({
    action: z.literal('lock'),
    ...auth,
    inputs: z.array(z.string().max(120)).max(3),
  }),
  z.object({
    action: z.literal('replace'),
    ...auth,
    input: z.string().max(120),
  }),
  z.object({ action: z.literal('react'), ...auth, emoji: z.string().max(8) }),
  z.object({ action: z.literal('next'), ...auth }),
  z.object({ action: z.literal('leave'), ...auth }),
  z.object({ action: z.literal('settings'), ...auth, settings }),
  z.object({
    action: z.literal('profile'),
    ...auth,
    name: profile.name.optional(),
    avatar: profile.avatar.optional(),
  }),
])

const noStore = { 'cache-control': 'no-store' }

function fail(e: unknown) {
  if (e instanceof RoomError)
    return Response.json(
      { error: e.message },
      { status: e.status, headers: noStore },
    )
  console.error('room api error', e)
  return Response.json(
    { error: 'Greška na poslužitelju. Pokušaj ponovno.' },
    { status: 500, headers: noStore },
  )
}

export const Route = createFileRoute('/api/room')({
  server: {
    handlers: {
      /** Poll: GET /api/room?code=XXXX with x-player-id / x-player-token headers. */
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const parsed = code.safeParse(url.searchParams.get('code') ?? '')
          if (!parsed.success) throw new RoomError('Neispravan kod sobe.')
          const playerId = request.headers.get('x-player-id') ?? ''
          const token = request.headers.get('x-player-token') ?? ''
          const { state } = await mutateRoom(parsed.data, (s) => {
            const now = Date.now()
            let changed = false
            const me = s.players.find(
              (p) => p.id === playerId && p.token === token,
            )
            if (me) changed = touch(s, me.id, now)
            changed = tick(s, now) || changed
            return { changed, result: null }
          })
          return Response.json(toPublic(state, Date.now()), {
            headers: noStore,
          })
        } catch (e) {
          return fail(e)
        }
      },
      POST: async ({ request }) => {
        try {
          const body = Action.safeParse(await request.json().catch(() => null))
          if (!body.success) throw new RoomError('Neispravan zahtjev.')
          const a = body.data
          const now = Date.now()

          if (a.action === 'create') {
            let session = { playerId: '', token: '' }
            const state = await insertRoom((c) => {
              const { state, player } = createRoom(
                c,
                a,
                a.settings as never,
                now,
              )
              session = { playerId: player.id, token: player.token }
              return state
            })
            return Response.json(
              {
                room: toPublic(state, now),
                session: { code: state.code, ...session },
              },
              { headers: noStore },
            )
          }

          if (a.action === 'join') {
            const { state, result } = await mutateRoom(a.code, (s) => {
              tick(s, now)
              const p = joinRoom(s, a, now)
              return {
                changed: true,
                result: { playerId: p.id, token: p.token },
              }
            })
            return Response.json(
              {
                room: toPublic(state, now),
                session: { code: state.code, ...result },
              },
              { headers: noStore },
            )
          }

          // Answers are judged (possibly by the AI, which takes a moment) before
          // the room is locked for writing. The deadline is checked against the
          // time the answer arrived, so judging time never counts as a timeout.
          let judged: Judged | undefined
          let lockVerdicts: (Verdict | null)[] = []
          if (
            a.action === 'answer' ||
            a.action === 'replace' ||
            a.action === 'lock'
          ) {
            const s = await readRoom(a.code)
            requirePlayer(s, a.playerId, a.token)
            tick(s, now)
            if (a.action === 'answer') {
              const { question, taken } = pendingJudgement(s, a.playerId)
              judged = await judgeAnswer(question, a.input, taken)
            } else if (a.action === 'replace') {
              const { question, taken } = pendingReplace(s, a.playerId)
              judged = await judgeAnswer(question, a.input, taken)
            } else {
              // All three answers are judged in parallel; cross-player
              // duplicates are only resolved during the reveal.
              const { question } = pendingLock(s, a.playerId)
              const none = { indexes: [], novels: [] }
              lockVerdicts = await Promise.all(
                a.inputs.map(async (input) => {
                  if (!input.trim()) return null
                  const j = await judgeAnswer(question, input, none)
                  return j.ok ? j.verdict : null
                }),
              )
            }
          }

          const { state } = await mutateRoom(a.code, (s) => {
            requirePlayer(s, a.playerId, a.token)
            touch(s, a.playerId, now)
            tick(s, now)
            switch (a.action) {
              case 'start':
                startGame(s, a.playerId, now)
                break
              case 'answer':
                submitAnswer(s, a.playerId, a.input, Date.now(), judged)
                break
              case 'lock':
                lockAnswers(s, a.playerId, a.inputs, lockVerdicts, Date.now())
                break
              case 'replace':
                replaceAnswer(s, a.playerId, a.input, Date.now(), judged)
                break
              case 'react':
                react(s, a.playerId, a.emoji, now)
                break
              case 'next':
                nextRound(s, a.playerId, now)
                break
              case 'leave':
                leaveRoom(s, a.playerId, now)
                break
              case 'settings':
                updateSettings(s, a.playerId, a.settings as never)
                break
              case 'profile':
                updateProfile(s, a.playerId, a)
                break
            }
            return { changed: true, result: null }
          })
          return Response.json(
            { room: toPublic(state, now) },
            { headers: noStore },
          )
        } catch (e) {
          return fail(e)
        }
      },
    },
  },
})
