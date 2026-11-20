import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Loader2,
  Maximize2,
  Scale,
  Send,
  Timer,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { categoryEmoji, categoryName } from '@/game/questions'
import { judgeLocally } from '@/game/judgeClient'
import { duplicateMessage, isCorrect } from '@/game/meaning'
import { WRONG_POINTS, bodova } from '@/game/engine'
import { fireConfetti } from '@/game/confetti'
import { sfx } from '@/game/sound'
import { usePanic } from '@/game/usePanic'
import type { Question, Turn } from '@/game/types'
import { ScoreColumn } from './ScoreColumn'

interface Props {
  question: Question
  roundNumber: number
  totalRounds: number
  player: number
  playerName?: string
  playerChip?: string
  timer: number
  takenAnswers: number[]
  takenNovels?: string[]
  onComplete: (turn: Turn) => void
}

export function PlayTurn({
  question,
  roundNumber,
  totalRounds,
  player,
  playerName,
  playerChip,
  timer,
  takenAnswers,
  takenNovels = [],
  onComplete,
}: Props) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [turn, setTurn] = useState<Turn | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timer)
  const [judging, setJudging] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const startedAt = useRef(0)

  useEffect(() => {
    inputRef.current?.focus()
    startedAt.current = Date.now()
  }, [])

  // Countdown timer
  useEffect(() => {
    if (!timer || turn || judging) return
    if (timeLeft <= 0) {
      sfx.timeUp()
      setTurn({
        player,
        input: '',
        answerIndex: null,
        points: WRONG_POINTS,
        timedOut: true,
        ms: timer * 1000,
      })
      return
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timer, timeLeft, turn, player, judging])

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (turn || judging) return
    const value = input.trim()
    if (!value) {
      setError('Upiši odgovor.')
      setShakeKey((k) => k + 1)
      return
    }
    sfx.click()
    const ms = Date.now() - startedAt.current
    setJudging(true)
    const judged = await judgeLocally(question, value, {
      indexes: takenAnswers,
      novels: takenNovels,
    })
    setJudging(false)
    if (!judged.ok) {
      setError(duplicateMessage(judged.duplicate))
      setShakeKey((k) => k + 1)
      inputRef.current?.focus()
      return
    }
    const v = judged.verdict
    setTurn({
      player,
      input: value,
      answerIndex: v.answerIndex,
      points: v.points,
      timedOut: false,
      novel: v.novel,
      judge: v.source,
      reason: v.reason,
      ms,
    })
  }

  const onRevealed = () => {
    setRevealed(true)
    if (turn && isCorrect(turn) && turn.points === 0) fireConfetti()
  }

  const { panic, fast } = usePanic(
    timer && !turn && !judging ? timeLeft : null,
    true,
  )

  const matched =
    turn && turn.answerIndex !== null
      ? question.answers[turn.answerIndex]
      : turn?.novel
        ? { text: turn.novel, points: turn.points }
        : null
  const jackpot = revealed && matched && turn?.points === 0
  const timePct = timer ? (timeLeft / timer) * 100 : 100

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Round meta */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/5 px-3 py-1 font-semibold ring-1 ring-white/10">
            {categoryEmoji(question.category)} {categoryName(question.category)}
          </span>
          {playerName && (
            <span
              className={cn(
                'rounded-full px-3 py-1 font-bold',
                playerChip ??
                  (player === 0
                    ? 'bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/40'
                    : 'bg-fuchsia-400/15 text-fuchsia-300 ring-1 ring-fuchsia-400/40'),
              )}
            >
              Na redu: {playerName}
            </span>
          )}
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
          Pitanje
        </p>
        <h2 className="font-display text-xl leading-tight font-bold text-balance sm:text-3xl">
          {question.text}
        </h2>
        {question.hint && (
          <p className="mt-3 text-sm text-muted-foreground">{question.hint}</p>
        )}

        {question.image && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="group relative block w-full overflow-hidden rounded-2xl border border-white/15 bg-black/40 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
            >
              <img
                src={question.image}
                alt={question.text}
                className="mx-auto max-h-72 w-full object-contain sm:max-h-96"
              />
              <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1.5 text-xs font-bold text-neon ring-1 ring-cyan-400/40 backdrop-blur-sm transition group-hover:scale-105">
                <Maximize2 className="size-3.5" /> Povećaj sliku
              </span>
            </button>
          </div>
        )}

        {zoomed && question.image && (
          <div
            onClick={() => setZoomed(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => setZoomed(false)}
              aria-label="Zatvori sliku"
              className="fixed top-4 right-4 z-50 flex size-11 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25"
            >
              <X className="size-6" />
            </button>
            <img
              src={question.image}
              alt={question.text}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain"
            />
          </div>
        )}

        {takenAnswers.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Već iskorišteno:{' '}
            {takenAnswers.map((i) => (
              <span
                key={i}
                className="mr-1 inline-block rounded-md bg-white/10 px-2 py-0.5 font-semibold text-foreground line-through decoration-white/40"
              >
                {question.answers[i].text}
              </span>
            ))}
          </p>
        )}

        {!turn ? (
          <form onSubmit={submit} className="mt-6">
            {timer > 0 && (
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Timer className="size-3.5" /> Preostalo vrijeme
                  </span>
                  <span
                    className={cn(
                      'font-display tabular-nums',
                      timeLeft <= 5 ? 'text-rose-400' : 'text-neon',
                    )}
                  >
                    {timeLeft} s
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-1000 ease-linear',
                      timeLeft <= 5 ? 'bg-rose-500' : 'bg-cyan-400',
                    )}
                    style={{ width: `${timePct}%` }}
                  />
                </div>
              </div>
            )}
            <div
              key={shakeKey}
              className={cn('flex gap-2', shakeKey > 0 && 'animate-shake')}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setError(null)
                }}
                placeholder="Upiši najopskurniji točan odgovor…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                aria-label="Tvoj odgovor"
                className={cn(
                  'h-14 min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/30 px-4 text-lg font-semibold placeholder:font-normal placeholder:text-muted-foreground/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 focus:outline-none',
                  panic && 'panic-shake border-rose-400',
                )}
              />
              <button
                type="submit"
                disabled={judging}
                className="btn-neon flex h-14 items-center gap-2 rounded-2xl px-5 font-bold disabled:opacity-70"
              >
                {judging ? (
                  <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Send className="size-5" />
                )}
                <span className="hidden sm:inline">Odgovori</span>
              </button>
            </div>
