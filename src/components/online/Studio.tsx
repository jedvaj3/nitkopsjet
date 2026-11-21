import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  Crown,
  Gem,
  Loader2,
  Send,
  WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScoreColumn } from '@/components/game/ScoreColumn'
import { bodova } from '@/game/engine'
import {
  categoryEmoji,
  categoryName,
  isAdultCategory,
  questionById,
} from '@/game/questions'
import { REPLACE_SECONDS, ROUND_DUPLICATE_MSG, trioSeconds } from '@/game/trio'
import { TrioFields } from '@/components/game/TrioFields'
import { usePanic } from '@/game/usePanic'
import { fireConfetti } from '@/game/confetti'
import { sfx } from '@/game/sound'
import {
  REACTIONS,
  type PublicPlayer,
  type PublicRoom,
  type PublicTurn,
  type Reaction,
} from '@/online/types'
import { ApiError } from '@/online/client'
import { Avatar, type AvatarMood } from './Avatar'
import type { RoomViewProps } from './Lobby'
import { StudioVehicleDrive, VehiclePickerBar } from './StudioVehicle'


/** The shared TV-studio view for turns, reveals and round summaries. */
export function Studio({ room, me, act, serverNow }: RoomViewProps) {
  const round = room.rounds[room.roundIdx]
  const last = room.lastTurn
  const current =
    room.players.find((p) => p.id === room.currentPlayerId) ?? null
  const myTurn = room.phase === 'turn' && room.currentPlayerId === me
  const trio = room.settings.format !== 'classic'
  const seatedMe = !!round?.order.includes(me)
  const myInput =
    room.phase === 'input' && seatedMe && !room.locked.includes(me)
  const myReplace = room.phase === 'replace' && room.replacing?.playerId === me
  const hasBar = myTurn || myInput || myReplace

  // Column animation bookkeeping: `revealSeq` = latest answer seen in the reveal
  // phase on this device, `doneSeq` = latest answer whose column has finished.
  const [revealSeq, setRevealSeq] = useState(0)
  const [doneSeq, setDoneSeq] = useState(0)
  if (room.phase === 'reveal' && last && last.seq > revealSeq)
    setRevealSeq(last.seq)
  const animating =
    !!last &&
    revealSeq === last.seq &&
    doneSeq < last.seq &&
    room.phase !== 'summary'
  const hidden = animating ? last : null

  // Ticking clock for the countdown.
  const [now, setNow] = useState(() => serverNow())
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 250)
    return () => clearInterval(id)
  }, [serverNow])
  const secondsLeft =
    (room.phase === 'turn' ||
      room.phase === 'input' ||
      room.phase === 'replace') &&
    room.deadline
      ? Math.max(0, Math.ceil((room.deadline - now) / 1000))
      : null
  const fullTime =
    room.phase === 'input'
      ? trioSeconds(room.settings.timer)
      : room.phase === 'replace'
        ? REPLACE_SECONDS
        : room.settings.timer

  // "Your turn" cue and last-seconds beeps on the active player's phone.
  const alert = myTurn || myReplace
  useEffect(() => {
    if (!alert) return
    sfx.timeWarning()
    navigator.vibrate?.(150)
  }, [alert, room.roundIdx, room.turnIdx])
  // Last 10 seconds: red pulsing studio for everyone, heartbeat for whoever is typing.
  const { panic, fast } = usePanic(secondsLeft, hasBar)

  /** The player's latest revealed answer this round. */
  const turnOf = (id: string) =>
    round?.turns.filter((t) => t.playerId === id).at(-1)
  const totalShown = (p: PublicPlayer) =>
    p.total - (hidden && hidden.playerId === p.id ? hidden.points : 0)

  const moodFor = (p: PublicPlayer): AvatarMood => {
    if (
      (room.phase === 'turn' || room.phase === 'replace') &&
      p.id === room.currentPlayerId
    )
      return 'thinking'
    if (room.phase === 'input')
      return room.locked.includes(p.id) ? 'idle' : 'thinking'
    const t = turnOf(p.id)
    if (!t) return 'idle'
    if (hidden && t.seq === hidden.seq) return 'thinking'
    if (t.answerText === null) return 'sad'
    if (t.points <= 10) return 'happy'
    return 'neutral'
  }

  // Reactions: show each one for ~2.5 s over the target's desk; pop sound for new ones.
  const flying = room.reactions.filter((r) => now - r.at < 2500)
  const lastReaction = Math.max(0, ...room.reactions.map((r) => r.id))
  const heardReaction = useRef(lastReaction)
  useEffect(() => {
    if (lastReaction > heardReaction.current) sfx.react()
    heardReaction.current = lastReaction
  }, [lastReaction])
  const canHeckle =
    !hasBar &&
    (room.phase === 'turn' ||
      room.phase === 'reveal' ||
      room.phase === 'replace') &&
    !!room.currentPlayerId &&
    room.currentPlayerId !== me

  const desks = room.players.map((p) => (
    <Desk
      key={p.id}
      reactions={flying.filter((r) => r.to === p.id)}
      player={p}
      mood={moodFor(p)}
      active={p.id === room.currentPlayerId && room.phase !== 'summary'}
      isMe={p.id === me}
      isHost={p.id === room.hostId}
      total={totalShown(p)}
      turn={turnOf(p.id)}
      thinking={
        ((room.phase === 'turn' || room.phase === 'replace') &&
          p.id === room.currentPlayerId) ||
        (room.phase === 'input' &&
          !room.locked.includes(p.id) &&
          !!round?.order.includes(p.id))
      }
      status={
        room.phase === 'input' && round?.order.includes(p.id)
          ? room.locked.includes(p.id)
            ? '🔒 zaključano'
            : '✍️ piše…'
          : undefined
      }
      chips={
        trio
          ? (round?.turns ?? []).filter(
              (t) => t.playerId === p.id && !(hidden && t.seq === hidden.seq),
            )
          : undefined
      }
      pending={!!hidden && hidden.playerId === p.id}
    />
  ))
  const half = Math.ceil(desks.length / 2)

  const center =
    room.phase === 'summary' ? (
      <RoundRecap
        room={room}
        me={me}
        act={act}
        serverNow={serverNow}
        now={now}
      />
    ) : (
      <div className="flex items-end justify-center gap-4">
        <div className="h-52 sm:h-64 lg:h-72">
          {animating && last ? (
            <ScoreColumn
              key={last.seq}
              target={last.answerText === null ? 100 : last.points}
              wrong={last.answerText === null}
              className="h-full"
              onDone={() => {
                setDoneSeq(last.seq)
                if (last.answerText !== null && last.points === 0)
                  fireConfetti()
              }}
            />
          ) : (
            <IdleColumn />
          )}
        </div>
        <StatusPanel
          className="w-40 sm:w-52"
          phase={room.phase}
          current={current}
          myTurn={myTurn}
          secondsLeft={secondsLeft}
          timer={fullTime}
          trio={trio}
          lockedCount={room.locked.length}
          seatedCount={round?.order.length ?? 0}
          replacing={room.replacing}
          replacingName={
            room.players.find((p) => p.id === room.replacing?.playerId)?.name
          }
          myReplace={myReplace}
          last={last}
          animating={animating}
          lastName={room.players.find((p) => p.id === last?.playerId)?.name}
        />
      </div>
    )

  return (
    <div
      className={cn(
        hasBar
          ? myInput
            ? 'pb-72 sm:pb-48'
            : 'pb-28'
          : canHeckle
            ? 'pb-24'
            : 'pb-4',
      )}
    >
      {/* Round meta + question */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="rounded-full bg-white/5 px-3 py-1 font-semibold ring-1 ring-white/10">
          {round && (
            <>
              {isAdultCategory(round.question.category) ? (
                <span className="mr-1 rounded bg-rose-500 px-1 text-[10px] font-black text-white">
                  18+
                </span>
              ) : (
                categoryEmoji(round.question.category) + ' '
              )}
              {categoryName(round.question.category)}
            </>
          )}
        </span>
        <span className="font-display text-xs tracking-widest text-muted-foreground uppercase">
          Runda {room.roundIdx + 1}/{room.totalRounds} · soba {room.code}
        </span>
      </div>
      {round && (
        <div className="panel rounded-3xl px-5 py-4 text-center sm:px-8 sm:py-5">
          <h2 className="font-display text-lg leading-tight font-bold text-balance sm:text-2xl">
            {round.question.text}
          </h2>
          {round.question.hint && (
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {round.question.hint}
            </p>
          )}
        </div>
      )}

            {/* Studio */}
      <div
        className={cn(
          'studio-floor relative mt-4 overflow-hidden rounded-3xl px-3 pt-4 pb-5 ring-1 ring-white/10 sm:px-5',
          panic && 'panic-glow',
          fast && 'panic-glow-fast',
        )}
      >
        {last && (() => {
          const idx = room.players.findIndex((p) => p.id === last.playerId)
          const driver = room.players[idx]
          if (!driver) return null
          return (
            <StudioVehicleDrive
             key={String(last.seq) + String(last.answerText)}

              player={driver}
              fromLeft={idx < half}
              isMe={driver.id === me}
              isZero={last.answerText !== null && last.points === 0}
              answerText={last.answerText}
            />
          )
        })()}
        <div className="lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-end lg:gap-6">
          <div className="hidden grid-cols-2 gap-x-3 gap-y-2 lg:grid">
            {desks.slice(0, half)}
          </div>
          <div className="lg:min-w-[22rem]">{center}</div>
          <div className="hidden grid-cols-2 gap-x-3 gap-y-2 lg:grid">
            {desks.slice(half)}
          </div>
          <VehiclePickerBar />

        </div>

        <div
          className={cn(
            'mt-5 grid gap-x-2 gap-y-2 lg:hidden',
            desks.length <= 3
              ? 'grid-cols-3'
              : desks.length === 4
                ? 'grid-cols-4'
                : 'grid-cols-4',
          )}
        >
          {desks}
        </div>
      </div>

      {canHeckle && <ReactionBar act={act} targetName={current?.name ?? ''} />}
      {myTurn && (
        <AnswerBar
          key={`${room.game}-${room.roundIdx}-${room.turnIdx}`}
          act={act}
          secondsLeft={secondsLeft}
          panic={panic}
        />
      )}
      {myInput && round && (
        <TrioFields
          key={`${room.game}-${room.roundIdx}`}
          docked
          panic={panic}
          question={questionById(round.question.id)}
          secondsLeft={secondsLeft}
          onLock={async (inputs) => {
            try {
              sfx.click()
              await act('lock', { inputs })
              return null
            } catch (e) {
              return e instanceof Error
                ? e.message
                : 'Zaključavanje nije uspjelo.'
            }
          }}
        />
      )}
      {myReplace && room.replacing && (
        <AnswerBar
          key={`r-${room.seq}`}
          act={act}
          action="replace"
          secondsLeft={secondsLeft}
          panic={panic}
          warning={`${ROUND_DUPLICATE_MSG} („${room.replacing.duplicate}”)`}
        />
      )}
    </div>
  )
}

function IdleColumn() {
  return (
    <div className="flex h-full items-stretch gap-3">
      <div className="flex flex-col justify-between py-1 text-[10px] font-semibold text-muted-foreground/70 tabular-nums sm:text-xs">
        {[100, 75, 50, 25, 0].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="column-track relative w-20 overflow-hidden rounded-2xl sm:w-24">
        <div className="column-fill absolute inset-x-0 bottom-0 h-full rounded-t-md opacity-60" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-5xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            ?
          </span>
        </div>
      </div>
    </div>
  )
}

function StatusPanel({
  className,
  phase,
  current,
  myTurn,
  secondsLeft,
  timer,
  trio,
  lockedCount,
  seatedCount,
  replacing,
  replacingName,
  myReplace,
  last,
  animating,
  lastName,
}: {
  className?: string
  phase: string
  current: PublicPlayer | null
  myTurn: boolean
  secondsLeft: number | null
  timer: number
  trio: boolean
  lockedCount: number
  seatedCount: number
  replacing: PublicRoom['replacing']
  replacingName?: string
  myReplace: boolean
  last: PublicTurn | null
  animating: boolean
  lastName?: string
}) {
  const countdown = secondsLeft !== null && (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
            secondsLeft <= 5 ? 'bg-rose-500' : 'bg-cyan-400',
          )}
          style={{
            width: `${Math.min(100, (secondsLeft / Math.max(1, timer)) * 100)}%`,
          }}
        />
      </div>
      <p
        className={cn(
          'mt-1 font-display text-2xl font-black tabular-nums',
          secondsLeft <= 5 && 'text-rose-400',
        )}
      >
        {secondsLeft} s
      </p>
    </div>
  )
  if (phase === 'input')
    return (
      <div className={cn('pb-2', className)} aria-live="polite">
        <p className="font-display text-base font-black text-gold">
          Svi upisuju 3 odgovora
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Zaključano:{' '}
          <b className="text-foreground">
            {lockedCount}/{seatedCount}
          </b>
          . Otkrivanje kreće kad svi zaključaju.
        </p>
        {countdown}
      </div>
    )
  if (phase === 'replace' && replacing && !animating)
    return (
      <div className={cn('pb-2', className)} aria-live="polite">
        <p className="text-sm font-bold text-amber-300">
          ⚖️ {ROUND_DUPLICATE_MSG.split('!')[0]}!
        </p>
        <p className="mt-1 text-sm">
          „{replacing.input}” = <b>{replacing.duplicate}</b>. Bez kazne —{' '}
          {myReplace ? (
            <b className="text-gold">upiši novi odgovor.</b>
          ) : (
            <>{replacingName} upisuje zamjenu…</>
          )}
        </p>
        {countdown}
      </div>
    )
  if (phase === 'reveal' || animating) {
    if (!last) return null
    const correct = last.answerText !== null
    return (
      <div className={cn('pb-2', className)} aria-live="polite">
        <p className="text-xs text-muted-foreground">
          {lastName}
          {trio && last.slot !== undefined
            ? ` · ${last.slot + 1}. odgovor`
            : ' odgovara'}
          :
        </p>
        <p className="text-lg leading-tight font-bold break-words">
          {last.timedOut
            ? '⏱️ Isteklo vrijeme'
            : last.input
              ? `„${last.input}”`
              : '— prazno polje —'}
        </p>
        {animating ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />{' '}
            Stupac se spušta…
          </p>
        ) : correct ? (
          <div className="animate-pop mt-2">
            <p
              className={cn(
                'font-display text-sm font-black uppercase',
                last.points === 0 ? 'text-gold' : 'text-neon',
              )}
            >
              {last.points === 0
                ? 'NitkoSjet! 🏆'
                : last.novel
                  ? 'Priznato!'
                  : 'Točno!'}
            </p>
            <p className="text-sm">
              {last.answerText} — <b>{last.points}</b> {bodova(last.points)}
            </p>
          </div>
        ) : (
          <p className="animate-pop mt-2 font-display text-sm font-black text-rose-400 uppercase">
            {last.timedOut
              ? 'Prekasno! +100'
              : last.input
                ? 'Netočno! +100'
                : 'Prazno! +100'}
          </p>
        )}
        {!animating && last.judge && last.judge !== 'baza' && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-neon">
              {last.judge === 'ai' ? '⚖️ AI sudac' : '⚖️ Ključne riječi'}
              {last.novel ? ' · nije u anketi, ali priznato' : ''}
            </span>
            {last.reason && <> · {last.reason}</>}
          </p>
        )}
      </div>
    )
  }
  return (
    <div className={cn('pb-2', className)} aria-live="polite">
      {myTurn ? (
        <p className="font-display text-xl font-black text-gold">
          Ti si na redu!
        </p>
      ) : (
        <p className="text-base">
          Na redu je <b className="text-neon">{current?.name ?? '…'}</b>
          <span className="animate-pulse motion-reduce:animate-none">…</span>
        </p>
      )}
      {countdown}
      {!myTurn && (
        <p className="mt-1 text-xs text-muted-foreground">
          Prati stupac — svi vide isto.
        </p>
      )}
    </div>
  )
}

function Desk({
  player,
  mood,
  active,
  isMe,
  isHost,
  total,
  turn,
  thinking,
  status,
  chips,
  pending,
  reactions = [],
}: {
  reactions?: Reaction[]
  player: PublicPlayer
  mood: AvatarMood
  active: boolean
  isMe: boolean
  isHost: boolean
  total: number
  turn?: PublicTurn
  thinking: boolean
  /** Short status in the bubble (e.g. while writing answers). */
  status?: string
  /** Trio: answers revealed so far this round, shown under the desk. */
  chips?: PublicTurn[]
  pending: boolean
}) {
  const bubble = status
    ? status
    : thinking
      ? '…'
      : turn
        ? turn.timedOut
          ? '⏱️'
          : turn.input
        : null
  const showPoints = turn && !pending
  return (
    <div className="relative flex min-w-0 flex-col items-center">
      {reactions.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="reaction-fly pointer-events-none absolute top-10 left-1/2 z-30 text-3xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:text-4xl"
          style={
            {
              '--dx': `${((r.id * 37) % 60) - 30}px`,
              '--rot': `${((r.id * 53) % 40) - 20}deg`,
            } as React.CSSProperties
          }
        >
          {r.emoji}
        </span>
      ))}
      <div className="flex h-12 w-full items-end justify-center">
        {bubble && (
          <div
            className={cn(
              'bubble animate-pop mb-1 max-w-full rounded-xl px-2 py-1 text-center text-[11px] leading-tight font-bold shadow-lg sm:text-xs',
              thinking
                ? 'bg-white/90 text-[#1a1330]'
                : showPoints && turn.answerText === null
                  ? 'bg-rose-500 text-white'
                  : showPoints && turn.points === 0
                    ? 'bg-amber-300 text-[#1a1000]'
                    : 'bg-white text-[#1a1330]',
            )}
          >
            <span className="line-clamp-2 break-words">
              {thinking && !status ? (
                <span className="animate-pulse">💭 …</span>
              ) : (
                bubble
              )}
            </span>
            {showPoints && !status && (
              <span className="block font-display text-[10px] font-black">
                {turn.points}
              </span>
            )}
          </div>
        )}
      </div>
      {active && (
        <div
          className="desk-spot pointer-events-none absolute inset-x-0 top-6 bottom-6"
          aria-hidden
        />
      )}
      <Avatar
        id={player.avatar}
        mood={mood}
        title={player.name}
        className={cn(
          'relative z-0 -mb-3 h-16 w-16 transition-opacity motion-reduce:transition-none sm:h-20 sm:w-20',
          !player.online && 'opacity-50',
        )}
      />
      <div
        className={cn(
          'desk relative z-10 w-full rounded-xl px-1.5 py-1 text-center',
          active && 'desk-active',
          isMe && !active && 'ring-1 ring-cyan-400/60',
        )}
      >
        <p className="flex items-center justify-center gap-0.5 text-[11px] font-bold sm:text-xs">
          {isHost && (
            <Crown className="size-3 shrink-0 text-gold" aria-label="Domaćin" />
          )}
          <span className="truncate">
            {isMe ? `${player.name} (ti)` : player.name}
          </span>
          {!player.online && (
            <WifiOff
              className="size-3 shrink-0 text-muted-foreground"
              aria-label="Nije spojen"
            />
          )}
        </p>
        <p
          className={cn(
            'font-display text-lg leading-none font-black tabular-nums sm:text-xl',
            active ? 'text-gold' : 'text-neon',
          )}
        >
          {total}
        </p>
      </div>
      {chips && chips.length > 0 && (
        <ul
          className="mt-1 w-full space-y-0.5"
          aria-label={`Otkriveni odgovori: ${player.name}`}
        >
          {chips.map((t) => (
            <li
              key={t.seq}
              className={cn(
                'flex items-center justify-between gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] ring-1 ring-white/5',
                t.answerText === null && 'text-rose-300',
              )}
            >
              <span className="truncate">
                {t.answerText ?? (t.input || 'prazno')}
              </span>
              <b className="tabular-nums">{t.points}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const REACTION_LABELS: Record<string, string> = {
  '😂': 'Smijeh',
  '🔥': 'Vatra',
  '💀': 'Propao si',
  '🤡': 'Klaun',
  '🤫': 'Pst!',
}

/** Quick heckling buttons for everyone who isn't on turn. */
function ReactionBar({
  act,
  targetName,
}: {
  act: RoomViewProps['act']
  targetName: string
}) {
  const [cooldown, setCooldown] = useState(false)
  const send = async (emoji: string) => {
    if (cooldown) return
    setCooldown(true)
    setTimeout(() => setCooldown(false), 650)
    sfx.react()
    try {
      await act('react', { emoji })
    } catch {
      /* rate-limited or the turn just ended — ignore */
    }
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0b0920]/90 px-4 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] backdrop-blur">
      <p className="mb-1 text-center text-[11px] text-muted-foreground">
        Podbodi igrača <b className="text-foreground">{targetName}</b>
      </p>
      <div
        className="mx-auto flex max-w-md justify-between gap-2"
        role="group"
        aria-label="Reakcije"
      >
        {REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => send(e)}
            aria-label={REACTION_LABELS[e]}
            title={REACTION_LABELS[e]}
            className={cn(
              'flex h-12 flex-1 items-center justify-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10 transition active:scale-90 motion-reduce:transition-none',
              cooldown ? 'opacity-50' : 'hover:bg-white/10',
            )}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

function AnswerBar({
  act,
  secondsLeft,
  action = 'answer',
  warning,
  panic,
}: {
  panic?: boolean
  act: RoomViewProps['act']
  secondsLeft: number | null
  action?: 'answer' | 'replace'
  /** Shown above the field (duplicate replacement). */
  warning?: string
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) {
      setError('Upiši odgovor.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      sfx.click()
      await act(action, { input: value })
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Slanje nije uspjelo.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-amber-300/30 bg-[#0b0920]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <div className="mx-auto max-w-2xl">
        {warning && (
          <p
            role="alert"
            className="mb-2 rounded-lg bg-amber-300/15 px-3 py-2 text-sm font-semibold text-amber-200 ring-1 ring-amber-300/40"
          >
            {warning}
          </p>
        )}
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            maxLength={80}
            autoComplete="off"
            enterKeyHint="send"
            placeholder={
              action === 'replace' ? 'Zamjenski odgovor…' : 'Tvoj odgovor…'
            }
            aria-label="Tvoj odgovor"
            className={cn(
              'h-12 min-w-0 flex-1 rounded-xl border bg-black/40 px-3 text-lg font-semibold focus:ring-2 focus:outline-none',
              panic
                ? 'panic-shake border-rose-400 focus:ring-rose-400/50'
                : 'border-amber-300/40 focus:border-amber-300 focus:ring-amber-300/40',
            )}
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
            <span className="hidden sm:inline">Pošalji</span>
          </button>
        </div>
        <p
          className={cn(
            'mt-1 text-xs',
            error ? 'font-semibold text-rose-400' : 'text-muted-foreground',
          )}
          role={error ? 'alert' : undefined}
        >
          {error ??
            (busy
              ? '⚖️ Sudac provjerava smisao odgovora…'
              : `Ti si na redu${secondsLeft !== null ? ` — još ${secondsLeft} s` : ''}. Isti odgovor ne vrijedi dvaput u rundi.`)}
        </p>
      </div>
    </form>
  )
}

function RoundRecap({ room, me, act, now }: RoomViewProps & { now: number }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const round = room.rounds[room.roundIdx]
  const isHost = room.hostId === me
  const isLast = room.roundIdx + 1 >= room.totalRounds
  const answers = round.answers ?? []
  const gems = answers.filter((a) => a.points <= 5).slice(0, 8)
  const given = new Set(round.turns.map((t) => t.answerText).filter(Boolean))
  const nameOf = (id: string) =>
    room.players.find((p) => p.id === id)?.name ?? 'Igrač'
  // One row per player: their answers this round and the round total.
  const byPlayer = [...new Set(round.turns.map((t) => t.playerId))]
    .map((id) => {
      const turns = round.turns.filter((t) => t.playerId === id)
      return { id, turns, sum: turns.reduce((s, t) => s + t.points, 0) }
    })
    .sort((a, b) => a.sum - b.sum)
  const auto = room.phaseUntil
    ? Math.max(0, Math.ceil((room.phaseUntil - now) / 1000))
    : null

  useEffect(() => {
    sfx.fanfare()
  }, [])

  return (
    <div className="mx-auto w-full max-w-xl">
      <h3 className="text-center font-display text-sm font-bold tracking-wider text-muted-foreground uppercase">
        Kraj runde {room.roundIdx + 1}
      </h3>
      <ol className="mt-3 space-y-1.5">
        {byPlayer.map((row, i) => (
          <li
            key={row.id}
            className={cn(
              'rounded-xl bg-black/30 px-3 py-2 ring-1 ring-white/5',
              i === 0 && 'gold-ring',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm font-bold">
                {nameOf(row.id)}
              </span>
              <span className="font-display text-lg font-black text-neon tabular-nums">
                {row.sum}
              </span>
            </div>
            <ul className="mt-1 flex flex-wrap gap-1">
              {row.turns.map((t) => (
                <li
                  key={t.seq}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs ring-1',
                    t.answerText === null
                      ? 'bg-rose-500/10 text-rose-300 ring-rose-500/30'
                      : t.points === 0
                        ? 'bg-amber-300/15 text-amber-200 ring-amber-300/40'
                        : 'bg-white/5 ring-white/10',
                  )}
                >
                  {t.answerText ??
                    (t.timedOut
                      ? 'isteklo vrijeme'
                      : t.input
                        ? `„${t.input}” ✗`
                        : 'prazno')}{' '}
                  · <b className="tabular-nums">{t.points}</b>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

              <div className="mt-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/5">
          <p className="mb-2 flex items-center gap-2 font-display text-xs font-bold tracking-wider text-gold uppercase">
            <Gem className="size-4" /> Najrjeđi odgovori (ispod 50 skriveni)
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {gems.map((g) => {
              const hide = g.points < 50 && !given.has(g.text)
              return (
                <li
                  key={g.text}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                    g.points === 0
                      ? 'bg-amber-300/15 text-amber-200 ring-amber-300/40'
                      : 'bg-white/5 ring-white/10',
                    hide && 'text-muted-foreground italic',
                  )}
                >
                  {hide ? '🔒 ???' : g.text} · <b>{g.points}</b>
                </li>
              )
            })}
          </ul>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {open ? 'Sakrij' : 'Prikaži'} sve točne odgovore ({answers.length})
            <ChevronDown
              className={cn(
                'size-4 transition-transform motion-reduce:transition-none',
                open && 'rotate-180',
              )}
            />
          </button>
          {open && (
            <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
              {answers.map((a) => {
                const hide = a.points < 50 && !given.has(a.text)
                return (
                  <li
                    key={a.text}
                    className={cn(
                      'flex justify-between gap-2 rounded-lg bg-white/5 px-2 py-1',
                      given.has(a.text) && 'text-gold',
                      hide && 'text-muted-foreground italic',
                    )}
                  >
                    <span className="truncate">
                      {hide ? '🔒 ??? (tajni odgovor)' : a.text}
                    </span>
                    <b className="tabular-nums">{a.points}</b>
                  </li>
                )
              })}
            </ul>
          )}
        </div>


      <div className="mt-4 text-center">
        {isHost ? (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              sfx.click()
              try {
                await act('next')
              } catch {
                /* the poll will catch up */
              } finally {
                setBusy(false)
              }
            }}
            className="btn-gold inline-flex h-12 items-center gap-2 rounded-2xl px-7 font-bold disabled:opacity-60"
          >
            {isLast ? 'Konačni rezultat' : 'Sljedeća runda'}{' '}
            <ArrowRight className="size-5" />
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Domaćin pokreće {isLast ? 'konačni rezultat' : 'sljedeću rundu'}…
          </p>
        )}
        {auto !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            Automatski za {auto} s
          </p>
        )}
      </div>
    </div>
  )
}
