import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Loader2, Scale, Send, Timer } from 'lucide-react'
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
  /** Classes for the "Na redu" chip. */
  playerChip?: string
  timer: number
  /** Answers already taken by the other player in this round. */
  takenAnswers: number[]
  /** Valid unlisted answers already given in this round. */
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
            {judging && (
              <p
                role="status"
                className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-neon"
              >
                <Scale className="size-4" /> Sudac provjerava smisao odgovora…
              </p>
            )}
            {error && (
              <p className="mt-2 text-sm font-medium text-rose-400">{error}</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Velika/mala slova i kvačice nisu bitni, a sitne tipfelere
              opraštamo.
            </p>
          </form>
        ) : (
          <div className="mt-6 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
            <ScoreColumn
              target={turn.points}
              wrong={!isCorrect(turn)}
              onDone={onRevealed}
              className="mx-auto h-64 sm:h-80"
            />
            <div className="text-center sm:text-left">
              <p className="text-sm text-muted-foreground">
                {turn.timedOut ? 'Isteklo je vrijeme!' : 'Tvoj odgovor'}
              </p>
              {!turn.timedOut && (
                <p className="font-display text-2xl font-bold break-words">
                  „{turn.input}”
                </p>
              )}
              <div className="mt-4 min-h-28">
                {revealed &&
                  (jackpot ? (
                    <div className="animate-pop">
                      <p className="jackpot-text font-display text-4xl font-black sm:text-5xl">
                        NITKOSJET!
                      </p>
                      <p className="mt-2 text-lg">
                        <b>{matched!.text}</b> — nitko od 100 ispitanika se toga
                        nije sjetio. 0 bodova!
                      </p>
                    </div>
                  ) : matched ? (
                    <div className="animate-pop">
                      <p className="font-display text-3xl font-black text-neon">
                        {turn.points} {bodova(turn.points)}
                      </p>
                      <p className="mt-1 text-lg">
                        {turn.novel ? 'Priznato' : 'Točno'} —{' '}
                        <b>{matched.text}</b>.{' '}
                        {turn.points <= 5
                          ? 'Odlično, gotovo nitko se toga nije sjetio!'
                          : turn.points <= 25
                            ? 'Vrlo dobar odgovor!'
                            : turn.points <= 60
                              ? 'Solidno, ali ima i opskurnijih.'
                              : 'Točno, ali toga se sjetila većina.'}
                      </p>
                    </div>
                  ) : (
                    <div className="animate-pop">
                      <p className="font-display text-3xl font-black text-rose-400">
                        Netočno · 100
                      </p>
                      <p className="mt-1 text-lg text-muted-foreground">
                        {turn.timedOut
                          ? 'Bez odgovora dobivaš maksimalnih 100 kaznenih bodova.'
                          : 'Taj odgovor nije točan — 100 kaznenih bodova.'}
                      </p>
                    </div>
                  ))}
                {revealed && turn.judge && turn.judge !== 'baza' && (
                  <JudgeNote turn={turn} />
                )}
              </div>
              {revealed && (
                <button
                  onClick={() => {
                    sfx.click()
                    onComplete(turn)
                  }}
                  autoFocus
                  className="btn-gold mt-4 inline-flex h-12 items-center gap-2 rounded-2xl px-6 font-bold"
                >
                  Dalje <ArrowRight className="size-5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Explains how a non-list answer was judged. */
export function JudgeNote({ turn }: { turn: Turn }) {
  const label =
    turn.judge === 'ai'
      ? turn.novel
        ? 'AI sudac: odgovor nije u anketi, ali ima smisla'
        : isCorrect(turn)
          ? 'AI sudac: isto značenje kao odgovor iz ankete'
          : 'AI sudac: odgovor nema smisla za ovo pitanje'
      : isCorrect(turn)
        ? 'Prepoznato po obliku riječi ili tipfeleru'
        : 'Ovog odgovora nema na popisu'
  return (
    <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
      <Scale className="mt-0.5 size-4 shrink-0 text-neon" />
      <span>
        <b className="text-foreground">{label}.</b>
        {turn.reason && <> {turn.reason}</>}
      </span>
    </p>
  )
}
