import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { questionById } from '@/game/questions'
import { judgeAnswer } from '@/server/judge'
import { rotateQuestion } from '@/game/rotate'

const Body = z.object({
  questionId: z.string().max(80),
  variant: z.number().int().min(0).max(1000).default(0),
  input: z.string().trim().min(1).max(120),
  takenIndexes: z.array(z.number().int().min(0).max(200)).max(50).default([]),
  takenNovels: z.array(z.string().max(80)).max(50).default([]),
})

const noStore = { 'cache-control': 'no-store' }

/**
 * POST /api/evaluate-answer — judges a player's answer for local games.
 * Returns { ok: true, verdict } or { ok: false, duplicate }.
 */
export const Route = createFileRoute('/api/evaluate-answer')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = Body.safeParse(await request.json().catch(() => null))
        if (!body.success)
          return Response.json(
            { error: 'Neispravan zahtjev.' },
            { status: 400, headers: noStore },
          )
        const base = questionById(body.data.questionId)
        const q = base && rotateQuestion(base, body.data.variant)
        if (!q)
          return Response.json(
            { error: 'Pitanje ne postoji.' },
            { status: 404, headers: noStore },
          )
        const judged = await judgeAnswer(q, body.data.input, {
          indexes: body.data.takenIndexes,
          novels: body.data.takenNovels,
        })
        return Response.json(judged, { headers: noStore })
      },
    },
  },
})
