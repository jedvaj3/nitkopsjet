import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Loader2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { bodova, playerColor, playerLabel } from '@/game/engine'
import { judgeLocally } from '@/game/judgeClient'
import { checkDuplicate, isCorrect, type Verdict } from '@/game/meaning'
import { fireConfetti } from '@/game/confetti'
import { sfx } from '@/game/sound'
import {
  REPLACE_SECONDS,
  ROUND_DUPLICATE_MSG,
  takenFrom,
  trioSequence,
} from '@/game/trio'
import type { GameConfig, Question, Turn } from '@/game/types'
import { ScoreColumn } from './ScoreColumn'
import { JudgeNote } from './PlayTurn'

export interface LocalEntry {
  /** Time taken to lock the answers. */
  ms?: number
  inputs: string[]
  verdicts: (Verdict | null)[]
}

interface Props {
  question: Question
  config: GameConfig
  /** Seat order for this round. */
  order: number[]
  entries: Record<number, LocalEntry>
  roundNumber: number
  totalRounds: number
  onDone: (turns: Turn[]) => void
}

const turnFromVerdict = (
  player: number,
  slot: number,
  input: string,
  v: Verdict | null,
  ms?: number,
): Turn =>
  v && input
    ? {
        player,
        slot,
        input,
        answerIndex: v.answerIndex,
        points: v.points,
        timedOut: false,
        novel: v.novel,
        judge: v.source,
        reason: v.reason,
        ms,
      }
    : {
        player,
        slot,
        input,
        answerIndex: null,
        points: 100,
        timedOut: false,
        ms,
      }

const turnVerdict = (t: Turn): Verdict => ({
  answerIndex: t.answerIndex,
  points: t.points,
  novel: t.novel,
  source: t.judge ?? 'baza',
})

/**
 * Local "Finale" reveal: answers are shown one by one in rounds over the
 * players (1st answers, then 2nd, then 3rd). An answer someone already
 * revealed isn't punished — its owner types a replacement.
 */
export function TrioReveal({
  question,
  config,
  order,
  entries,
  roundNumber,
  totalRounds,
  onDone,
}: Props) {
  const seq = useMemo(() => trioSequence(order), [order])
  const [idx, setIdx] = useState(0)
  const [turns, setTurns] = useState<Turn[]>([])
  const [current, setCurrent] = useState<Turn | null>(null)
  const [done, setDone] = useState(false)
  const [replacing, setReplacing] = useState<string | null>(null)
  const item = seq[idx]
  const finished = idx >= seq.length

  // Prepare the next answer: reveal it, or ask for a replacement if it's a duplicate.
  useEffect(() => {
    if (!item || current || replacing) return
    const e = entries[item.player]
    const turn = turnFromVerdict(
      item.player,
      item.slot,
      e?.inputs[item.slot] ?? '',
      e?.verdicts[item.slot] ?? null,
      e?.ms,
    )
    if (isCorrect(turn)) {
      const taken = takenFrom(
        turns.filter((t) => isCorrect(t)).map(turnVerdict),
      )
      const dup = checkDuplicate(question, turnVerdict(turn), taken)
      if (!dup.ok) {
        sfx.timeWarning()
        setReplacing(dup.duplicate)
        return
      }
    }
    setCurrent(turn)
    setDone(false)
  }, [item, current, replacing, entries, turns, question])

  const next = () => {
    if (!current) return
    sfx.click()
    setTurns((t) => [...t, current])
    setCurrent(null)
    setIdx((i) => i + 1)
  }

  const totals = (p: number) =>
    [...turns, ...(current && done ? [current] : [])]
      .filter((t) => t.player === p)
      .reduce((s, t) => s + t.points, 0)
  const shown = [...turns, ...(current && done ? [current] : [])]

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="rounded-full bg-white/5 px-3 py-1 font-semibold ring-1 ring-white/10">
          Otkrivanje · {item ? `${item.slot + 1}. krug` : 'gotovo'}
        </span>
        <span className="font-display text-xs tracking-widest text-muted-foreground uppercase">
          Runda {roundNumber}/{totalRounds}
        </span>
      </div>
      <div className="panel rounded-3xl p-5 text-center sm:p-6">
        <h2 className="font-display text-lg leading-tight font-bold text-balance sm:text-2xl">
          {question.text}
        </h2>
      </div>

      <div className="studio-floor mt-4 rounded-3xl p-4 ring-1 ring-white/10 sm:p-6">
        {replacing && item ? (
          <ReplaceForm
            key={`${item.player}-${item.slot}`}
            question={question}
            config={config}
            player={item.player}
            original={entries[item.player]?.inputs[item.slot] ?? ''}
            duplicate={replacing}
            taken={takenFrom([
              ...turns.filter((t) => isCorrect(t)).map(turnVerdict),
              ...(entries[item.player]?.verdicts ?? []).filter(
                (v, i): v is Verdict =>
                  i !== item.slot &&
                  !!v &&
                  (v.answerIndex !== null || !!v.novel),
              ),
            ])}
            onDone={(turn) => {
              setReplacing(null)
              setCurrent({ ...turn, slot: item.slot })
              setDone(false)
            }}
          />
        ) : current ? (
          <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
            <ScoreColumn
              key={`${current.player}-${current.slot}`}
              target={current.points}
              wrong={!isCorrect(current)}
              className="mx-auto h-56 sm:h-64"
              onDone={() => {
                setDone(true)
                if (isCorrect(current) && current.points === 0) fireConfetti()
              }}
            />
            <div className="text-center sm:text-left" aria-live="polite">
              <p
                className={cn(
                  'text-sm font-bold',
                  playerColor(config, current.player).text,
                )}
              >
                {playerLabel(config, current.player)} ·{' '}
                {(current.slot ?? 0) + 1}. odgovor
              </p>
              <p className="font-display text-2xl font-bold break-words">
                {current.timedOut
                  ? '⏱️ Isteklo vrijeme'
                  : current.input
                    ? `„${current.input}”`
                    : '— prazno polje —'}
              </p>
              {done && (
                <div className="animate-pop mt-3">
                  {isCorrect(current) ? (
                    <p className="text-lg">
                      <b
                        className={
                          current.points === 0 ? 'text-gold' : 'text-neon'
                        }
                      >
                        {current.points === 0 ? 'NITKOSJET! ' : ''}
                        {current.points} {bodova(current.points)}
                      </b>{' '}
                      —{' '}
                      {current.novel ??
                        question.answers[current.answerIndex!].text}
                    </p>
                  ) : (
                    <p className="font-display text-xl font-black text-rose-400">
                      {current.input ? 'Netočno' : 'Prazno'} · 100
                    </p>
                  )}
                  {current.judge && current.judge !== 'baza' && (
                    <JudgeNote turn={current} />
                  )}
                  <button
                    onClick={next}
                    autoFocus
                    className="btn-gold mt-4 inline-flex h-12 items-center gap-2 rounded-2xl px-6 font-bold"
                  >
                    {idx + 1 >= seq.length
                      ? 'Završi otkrivanje'
                      : 'Sljedeći odgovor'}{' '}
                    <ArrowRight className="size-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : finished ? (
          <div className="text-center">
            <p className="font-display text-lg font-bold">
              Svi odgovori su otkriveni!
            </p>
            <button
              onClick={() => onDone(turns)}
              autoFocus
              className="btn-gold mt-4 inline-flex h-12 items-center gap-2 rounded-2xl px-6 font-bold"
            >
              Pregled runde <ArrowRight className="size-5" />
            </button>
          </div>
        ) : null}

        {/* Players with their revealed answers */}
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {order.map((p) => (
            <li
              key={p}
              className={cn(
                'desk rounded-xl p-2',
                (current?.player === p || (replacing && item?.player === p)) &&
                  'desk-active',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    'truncate text-sm font-bold',
                    playerColor(config, p).text,
                  )}
                >
                  {config.players[p]}
                </span>
                <span className="font-display text-lg font-black text-neon tabular-nums">
                  {totals(p)}
                </span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {shown
                  .filter((t) => t.player === p)
                  .map((t) => (
                    <li
                      key={t.slot}
                      className={cn(
                        'flex justify-between gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[11px]',
                        !isCorrect(t) && 'text-rose-300',
                      )}
                    >
                      <span className="truncate">
                        {t.novel ??
                          (t.answerIndex !== null
                            ? question.answers[t.answerIndex].text
                            : t.input || 'prazno')}
                      </span>
                      <b className="tabular-nums">{t.points}</b>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ReplaceForm({
  question,
  config,
  player,
  original,
  duplicate,
  taken,
  onDone,
}: {
  question: Question
  config: GameConfig
  player: number
  original: string
  duplicate: string
  taken: ReturnType<typeof takenFrom>
  onDone: (turn: Turn) => void
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timed = config.timer > 0
  const [left, setLeft] = useState(REPLACE_SECONDS)
  const slot = 0 // the parent sets the real slot
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!timed || busy) return
    if (left <= 0) {
      doneRef.current({
        player,
        slot,
        input: '',
        answerIndex: null,
        points: 100,
        timedOut: true,
      })
      return
    }
    if (left <= 5) sfx.timeWarning()
    const id = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(id)
  }, [left, timed, busy, player])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return setError('Upiši zamjenski odgovor.')
    setBusy(true)
    setError(null)
    const j = await judgeLocally(question, value.trim(), taken)
    setBusy(false)
    if (!j.ok) return setError(ROUND_DUPLICATE_MSG)
    const v = j.verdict
    onDone({
      player,
      slot,
      input: value.trim(),
      answerIndex: v.answerIndex,
      points: v.points,
      timedOut: false,
      novel: v.novel,
      judge: v.source,
      reason: v.reason,
    })
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg text-center">
      <p
        role="alert"
        className="rounded-xl bg-amber-300/15 px-3 py-2 font-semibold text-amber-200 ring-1 ring-amber-300/40"
      >
        ⚖️ {ROUND_DUPLICATE_MSG}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        <b className={playerColor(config, player).text}>
          {playerLabel(config, player)}
        </b>
        : „{original}” = <b className="text-foreground">{duplicate}</b> — bez
        kaznenih bodova, samo upiši drugi odgovor.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          autoFocus
          maxLength={80}
          autoComplete="off"
          placeholder="Zamjenski odgovor…"
          aria-label="Zamjenski odgovor"
          className="h-12 min-w-0 flex-1 rounded-xl border border-amber-300/40 bg-black/40 px-3 text-lg font-semibold focus:border-amber-300 focus:ring-2 focus:ring-amber-300/40 focus:outline-none"
        />
        <button
          disabled={busy}
          className="btn-gold inline-flex h-12 items-center gap-2 rounded-xl px-4 font-bold disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Send className="size-5" />
          )}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-sm font-semibold text-rose-400">{error}</p>
      )}
      {timed && (
        <p
          className={cn(
            'mt-2 font-display text-xl font-black tabular-nums',
            left <= 5 && 'text-rose-400',
          )}
        >
          {left} s
        </p>
      )}
    </form>
  )
}
