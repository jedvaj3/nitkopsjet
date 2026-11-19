import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Crown,
  Home,
  PartyPopper,
  RotateCcw,
  Save,
  Share2,
  Swords,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  bodova,
  buildShareText,
  playerColor,
  shareText,
  sideColor,
  SITE,
  sideName,
  standings,
  usesLives,
} from '@/game/engine'
import { categoryName, isAdultCategory } from '@/game/questions'
import { fireConfetti } from '@/game/confetti'
import { sfx } from '@/game/sound'
import {
  addToLeaderboard,
  getLeaderboard,
  getPersonalBest,
  getPrefs,
  savePrefs,
  totalFor,
  type LeaderboardEntry,
} from '@/game/storage'
import type { GameConfig, Round } from '@/game/types'
import { answerLabel, isCorrect } from '@/game/meaning'
import { assignTitles, podiumShareText, type PodiumEntry } from '@/game/titles'
import { AVATAR_COUNT } from '@/online/avatars'
import { Podium, TitleList } from './Podium'
import { LeaderboardList } from './Leaderboard'

interface Props {
  config: GameConfig
  rounds: Round[]
  lives: number[]
  onReplay: () => void
  onMenu: () => void
}

export function FinalScreen({
  config,
  rounds,
  lives,
  onReplay,
  onMenu,
}: Props) {
  const share = async () => {
    const text =
      config.mode === 'solo'
        ? buildShareText(config, rounds)
        : podiumShareText(
            `NitkoSjet — ${MODE_LABEL[config.mode].label}`,
            podiumEntries(config, rounds, lives),
            [
              ...(config.mode === 'teams'
                ? [
                    '',
                    'Titule:',
                    ...config.players.map((name, p) => {
                      const t = playerTitles(config, rounds)[String(p)]
                      return `${t.emoji} ${name} — ${t.name}`
                    }),
                  ]
                : []),
              '',
              `${categoryName(config.category)} · Možeš li bolje? 👉 https://${SITE}`,
            ],
          )
    const res = await shareText(text)
    if (res === 'copied')
      toast.success('Rezultat je kopiran — zalijepi ga ekipi u chat!')
    else if (res === 'failed') toast.error('Dijeljenje nije uspjelo.')
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {config.mode === 'solo' ? (
        <SoloResult config={config} rounds={rounds} />
      ) : (
        <>
          <MultiResult config={config} rounds={rounds} lives={lives} />
          <TitleList
            entries={config.players.map((name, p) => ({
              id: String(p),
              name,
              total: 0,
              place: 0,
              title: playerTitles(config, rounds)[String(p)],
            }))}
          />
        </>
      )}

      {/* Per-round breakdown */}
      <div className="panel mt-6 rounded-2xl p-4 sm:p-5">
        <h3 className="mb-3 font-display text-sm font-bold tracking-wider text-muted-foreground uppercase">
          Po rundama
        </h3>
        <ul className="space-y-2">
          {rounds.map((r, i) => (
            <li
              key={r.question.id}
              className="rounded-xl bg-black/25 px-3 py-2.5 ring-1 ring-white/5"
            >
              <p className="text-xs text-muted-foreground">
                R{i + 1} · {r.question.text}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                {r.turns.map((t) => {
                  const label = answerLabel(r.question, t)
                  const a = label ? { text: label } : null
                  return (
                    <p
                      key={`${t.player}-${t.slot ?? 0}`}
                      className="flex items-baseline gap-2"
                    >
                      {config.mode !== 'solo' && (
                        <span
                          className={cn(
                            'text-xs font-bold',
                            playerColor(config, t.player).text,
                          )}
                        >
                          {config.players[t.player]}:
                        </span>
                      )}
                      <span className="font-semibold">
                        {a ? (
                          a.text
                        ) : (
                          <span className="text-rose-400">promašaj</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'font-display font-black tabular-nums',
                          t.points === 0 && a
                            ? 'text-gold'
                            : a
                              ? 'text-neon'
                              : 'text-rose-400',
                        )}
                      >
                        {t.points}
                      </span>
                    </p>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <button
          onClick={share}
          className="btn-neon inline-flex h-12 items-center justify-center gap-2 rounded-2xl font-bold"
        >
          <Share2 className="size-5" /> Podijeli rezultat
        </button>
        <button
          onClick={onReplay}
          className="btn-gold inline-flex h-12 items-center justify-center gap-2 rounded-2xl font-bold"
        >
          <RotateCcw className="size-5" /> Igraj ponovno
        </button>
        <button
          onClick={onMenu}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/5 font-bold ring-1 ring-white/15 hover:bg-white/10"
        >
          <Home className="size-5" /> Izbornik
        </button>
      </div>
    </div>
  )
}

function SoloResult({
  config,
  rounds,
}: {
  config: GameConfig
  rounds: Round[]
}) {
  const total = totalFor(rounds, 0)
  const jackpots = rounds.filter(
    (r) => isCorrect(r.turns[0]) && r.turns[0].points === 0,
  ).length
  // Read the record before this game is saved.
  const [prevBest] = useState(() => getPersonalBest())
  const isRecord = prevBest === null || total < prevBest
  const [name, setName] = useState(() => getPrefs().lastName)
  const [saved, setSaved] = useState<LeaderboardEntry | null>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [board, setBoard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    setBoard(getLeaderboard())
    if (isRecord) {
      sfx.fanfare()
      fireConfetti(2500)
    }
  }, [isRecord])

  const avg = useMemo(
    () => Math.round(total / rounds.length),
    [total, rounds.length],
  )

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim() || 'Anonimac'
    const entry: LeaderboardEntry = {
      name: n.slice(0, 24),
      score: total,
      category: config.category,
      timer: config.timer,
      jackpots,
      date: new Date().toISOString(),
    }
    const r = addToLeaderboard(entry)
    savePrefs({ lastName: n })
    setSaved(entry)
    setRank(r)
    setBoard(getLeaderboard())
    toast.success(
      r ? `Upisan/a si na ljestvicu — ${r}. mjesto!` : 'Rezultat spremljen.',
    )
  }

  return (
    <>
      <div className="panel rounded-3xl p-6 text-center sm:p-8">
        <p className="font-display text-xs tracking-[0.25em] text-muted-foreground uppercase">
          Solo izazov · {categoryName(config.category)}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">Ukupno</p>
        <p
          className={cn(
            'animate-pop font-display text-7xl font-black tabular-nums sm:text-8xl',
            isRecord ? 'text-gold' : 'text-neon',
          )}
        >
          {total}
        </p>
        <p className="text-muted-foreground">
          {bodova(total)} · prosjek {avg} po rundi
          {jackpots > 0 && (
            <>
              {' '}
              ·{' '}
              <span className="font-bold text-gold">
                {jackpots}× NitkoSjet!
              </span>
            </>
          )}
        </p>
        <p className="mt-4 text-lg font-semibold">
          {isRecord ? (
            <span className="text-gold">
              <Crown className="mr-1 inline size-5 -translate-y-0.5" />
              {prevBest === null
                ? 'Prvi rekord je postavljen!'
                : `Novi osobni rekord! (prije: ${prevBest})`}
            </span>
          ) : (
            <>
              Tvoj rekord je {prevBest} — trebalo je {total - prevBest! + 1}{' '}
              {bodova(total - prevBest! + 1)} manje za novi.
            </>
          )}
        </p>
      </div>

      <div className="panel mt-6 rounded-2xl p-4 sm:p-5">
        <h3 className="mb-3 font-display text-sm font-bold tracking-wider text-gold uppercase">
          Lokalna ljestvica
        </h3>
        {!saved ? (
          <form onSubmit={save} className="mb-4 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Tvoje ime ili nadimak"
              aria-label="Ime za ljestvicu"
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 font-semibold focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 focus:outline-none"
            />
            <button className="btn-gold inline-flex h-11 items-center gap-2 rounded-xl px-4 font-bold">
              <Save className="size-4" /> Spremi
            </button>
          </form>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">
            {rank ? `Spremljeno na ${rank}. mjesto.` : 'Spremljeno.'}
          </p>
        )}
        <LeaderboardList entries={board} highlight={saved} />
      </div>
    </>
  )
}

const MODE_LABEL = {
  duel: { label: 'Dvoboj', icon: Swords, win: 'pobjeđuje u dvoboju!' },
  teams: { label: 'Timovi 2 na 2', icon: Users, win: 'pobjeđuje!' },
  ffa: { label: 'Svatko za sebe', icon: PartyPopper, win: 'pobjeđuje!' },
} as const

/** One fun title per player, from all their answers this game. */
function playerTitles(config: GameConfig, rounds: Round[]) {
  return assignTitles(
    config.players.map((name, p) => ({
      id: String(p),
      name,
      turns: rounds.flatMap((r) =>
        r.turns
          .filter((t) => t.player === p)
          .map((t) => ({
            points: t.points,
            correct: isCorrect(t),
            adult: isAdultCategory(r.question.category),
            ms: t.ms,
            novel: !!t.novel,
          })),
      ),
    })),
  )
}

/** Podium rows: sides (teams or players) in standing order. */
function podiumEntries(
  config: GameConfig,
  rounds: Round[],
  lives: number[],
): PodiumEntry[] {
  const titles = config.mode === 'teams' ? {} : playerTitles(config, rounds)
  return standings(config, rounds, lives).map((r) => ({
    id: String(r.side),
    name: sideName(config, r.side),
    total: r.total,
    place: r.place,
    avatar: (r.side * 5) % AVATAR_COUNT,
    title: titles[String(r.side)],
  }))
}

function MultiResult({
  config,
  rounds,
  lives,
}: {
  config: GameConfig
  rounds: Round[]
  lives: number[]
}) {
  const rows = standings(config, rounds, lives)
  const leaders = rows.filter((r) => r.place === 1)
  const winner = leaders.length === 1 ? leaders[0].side : null
  const withLives = usesLives(config)
  const meta = MODE_LABEL[config.mode === 'solo' ? 'duel' : config.mode]

  return (
    <div className="panel rounded-3xl p-6 text-center sm:p-8">
      <p className="font-display text-xs tracking-[0.25em] text-muted-foreground uppercase">
        <meta.icon className="mr-1 inline size-4" /> {meta.label} ·{' '}
        {categoryName(config.category)}
      </p>
      {winner !== null ? (
        <>
          <Crown className="animate-float mx-auto mt-4 size-10 text-gold" />
          <p className="animate-pop font-display text-4xl font-black break-words text-gold sm:text-5xl">
            {sideName(config, winner)}
          </p>
          <p className="mt-1 text-lg">{meta.win}</p>
        </>
      ) : (
        <>
          <p className="animate-pop mt-4 font-display text-4xl font-black text-neon">
            Neriješeno!
          </p>
          {leaders.length > 2 || config.mode === 'ffa' ? (
            <p className="mt-1 text-muted-foreground">
              Prvo mjesto dijele:{' '}
              {leaders.map((l) => sideName(config, l.side)).join(', ')}
            </p>
          ) : null}
        </>
      )}
      <div className="mt-8">
        <Podium entries={podiumEntries(config, rounds, lives)} />
      </div>
      {withLives && (
        <p className="mt-3 text-sm">
          {rows.map((r) => (
            <span key={r.side} className="mx-2 inline-block">
              <b className={sideColor(r.side).text}>
                {sideName(config, r.side)}
              </b>{' '}
              {'❤️'.repeat(Math.max(0, r.lives)) || '💔'}
            </span>
          ))}
        </p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        {withLives
          ? `Pobjeđuje ${config.mode === 'teams' ? 'tim' : 'igrač'} s više preostalih života; kod jednakog broja života odlučuje manji zbroj bodova.`
          : 'Pobjeđuje igrač s najmanjim ukupnim zbrojem bodova.'}
      </p>
    </div>
  )
}
