import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { categoryEmoji, categoryName } from '@/game/questions'
import { judgeLocally } from '@/game/judgeClient'
import type { Verdict } from '@/game/meaning'
import { OWN_DUPLICATE_MSG, ownDuplicateSlots, trioSeconds } from '@/game/trio'
import type { Question } from '@/game/types'
import { TrioFields } from './TrioFields'
import { usePanic } from '@/game/usePanic'
import type { LocalEntry } from './TrioReveal'

interface Props {
  question: Question
  playerName: string
  playerChip: string
  timer: number
  roundNumber: number
  totalRounds: number
  onLocked: (entry: LocalEntry) => void
}

/** A player privately writes their 3 answers on the shared device. */
export function TrioEntry({
  question,
  playerName,
  playerChip,
  timer,
  roundNumber,
  totalRounds,
  onLocked,
}: Props) {
  const total = trioSeconds(timer)
  const [left, setLeft] = useState(total)
  const startedAt = useRef(0)
  useEffect(() => {
    startedAt.current = Date.now()
  }, [])

  useEffect(() => {
    if (!total || left <= 0) return
    const id = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(id)
  }, [left, total])

  const { panic, fast } = usePanic(total ? left : null, true)

  const lock = async (inputs: string[]) => {
    const ms = Date.now() - startedAt.current
    const none = { indexes: [], novels: [] }
    const verdicts: (Verdict | null)[] = await Promise.all(
      inputs.map(async (v) => {
        if (!v.trim()) return null
        const j = await judgeLocally(question, v.trim(), none)
        return j.ok ? j.verdict : null
      }),
    )
    // Same meaning in two fields (e.g. slang for the same answer) is caught here.
    if (ownDuplicateSlots(inputs, verdicts).length) return OWN_DUPLICATE_MSG
    onLocked({ inputs: inputs.map((v) => v.trim()), verdicts, ms })
    return null
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/5 px-3 py-1 font-semibold ring-1 ring-white/10">
            {categoryEmoji(question.category)} {categoryName(question.category)}
          </span>
          <span className={cn('rounded-full px-3 py-1 font-bold', playerChip)}>
            Piše: {playerName}
          </span>
        </div>
        <span className="font-display text-xs tracking-widest text-muted-foreground uppercase">
          Runda {roundNumber}/{totalRounds}
        </span>
      </div>
      <div
        className={cn(
          'panel rounded-3xl p-5 sm:p-8',
          panic && 'panic-glow',
          fast && 'panic-glow-fast',
        )}
      >
        <p className="mb-2 text-xs font-bold tracking-[0.2em] text-neon uppercase">
          Pitanje · 3 odgovora
        </p>
        <h2 className="font-display text-xl leading-tight font-bold text-balance sm:text-3xl">
          {question.text}
        </h2>
        {question.hint && (
          <p className="mt-3 text-sm text-muted-foreground">{question.hint}</p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Upiši tajno do 3 odgovora pa zaključaj. Ostali ih vide tek pri
          otkrivanju.
        </p>
        <div className="mt-5">
          <TrioFields
            question={question}
            onLock={lock}
            secondsLeft={total ? left : null}
            panic={panic}
          />
        </div>
      </div>
    </div>
  )
}
