import { useEffect, useState } from 'react'
import {
  BookOpen,
  Globe,
  PartyPopper,
  Play,
  Swords,
  Target,
  Timer,
  TimerOff,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORIES, QUESTIONS, STANDARD_CATEGORIES } from '@/game/questions'
import { AgeGate } from './AgeGate'
import { DailyChallenge } from './DailyChallenge'
import { FormatPicker } from './FormatPicker'
import { DEFAULT_FORMAT, type RoundFormat } from '@/game/trio'
import {
  DUEL_LIVES,
  DUEL_ROUNDS,
  FFA_MAX_PLAYERS,
  FFA_MIN_PLAYERS,
  FFA_ROUNDS,
  SOLO_ROUNDS,
  TEAM_ROUNDS,
  sideColor,
} from '@/game/engine'
import { getPersonalBest, getPrefs, savePrefs } from '@/game/storage'
import { sfx, unlockAudio } from '@/game/sound'
import type {
  CategoryChoice,
  GameConfig,
  GameMode,
  TimerSetting,
} from '@/game/types'

interface Props {
  onStart: (config: GameConfig) => void
  onOpenLeaderboard: () => void
  onOpenRules: () => void
  onOpenOnline: () => void
}

const TIMERS: {
  value: TimerSetting
  label: string
  sub: string
  icon: typeof Timer
}[] = [
  { value: 0, label: 'Opušteno', sub: 'bez tajmera', icon: TimerOff },
  { value: 30, label: '30 sekundi', sub: 'klasično', icon: Timer },
  { value: 15, label: '15 sekundi', sub: 'za hrabre', icon: Zap },
]

export function Menu({
  onStart,
  onOpenLeaderboard,
  onOpenRules,
  onOpenOnline,
}: Props) {
  const [mode, setMode] = useState<GameMode>('solo')
  const [format, setFormat] = useState<RoundFormat>(DEFAULT_FORMAT)
  const [category, setCategory] = useState<CategoryChoice>('mix')
  const [timer, setTimer] = useState<TimerSetting>(30)
  const [players, setPlayers] = useState<string[]>([
    'Igrač 1',
    'Igrač 2',
    'Igrač 3',
    'Igrač 4',
    'Igrač 5',
  ])
  const [ffaCount, setFfaCount] = useState(FFA_MIN_PLAYERS)
  const [teamPlayers, setTeamPlayers] = useState<string[]>([
    'Igrač A1',
    'Igrač A2',
    'Igrač B1',
    'Igrač B2',
  ])
  const [teamNames, setTeamNames] = useState<[string, string]>([
    'Tim A',
    'Tim B',
  ])
  const [best, setBest] = useState<number | null>(null)
  const [adultOk, setAdultOk] = useState(false)
  const [gateOpen, setGateOpen] = useState(false)

  useEffect(() => {
    const p = getPrefs()
    setCategory(p.category)
    setTimer(p.timer)
    setPlayers(p.players)
    setFfaCount(p.ffaCount)
    setTeamPlayers(p.teamPlayers)
    setTeamNames(p.teamNames)
    setFormat(p.format)
    setBest(getPersonalBest())
    setAdultOk(p.adultConfirmed)
    if (p.category === 'odrasli' && !p.adultConfirmed) setCategory('mix')
  }, [])

  const start = () => {
    unlockAudio()
    sfx.click()
    const names = players.map((n, i) => n.trim() || `Igrač ${i + 1}`)
    const tPlayers = teamPlayers.map(
      (n, i) => n.trim() || `Igrač ${i < 2 ? 'A' : 'B'}${(i % 2) + 1}`,
    )
    const tNames: [string, string] = [
      (teamNames.at(0) ?? '').trim() || 'Tim A',
      (teamNames.at(1) ?? '').trim() || 'Tim B',
    ]
    savePrefs({
      category,
      timer,
      players: names,
      ffaCount,
      teamPlayers: tPlayers,
      teamNames: tNames,
      format,
    })
    const base = { mode, category, timer, format }
    if (mode === 'solo') onStart({ ...base, players: ['Ti'] })
    else if (mode === 'duel') onStart({ ...base, players: names.slice(0, 2) })
    else if (mode === 'ffa')
      onStart({ ...base, players: names.slice(0, ffaCount) })
    else
      onStart({
        ...base,
        players: [
          tPlayers.at(0) ?? 'Igrač A1',
          tPlayers.at(2) ?? 'Igrač B1',
          tPlayers.at(1) ?? 'Igrač A2',
          tPlayers.at(3) ?? 'Igrač B2',
        ],
        teams: tNames,
      })
  }

  const counts = (id: CategoryChoice) =>
    id === 'mix'
      ? QUESTIONS.filter((q) =>
          STANDARD_CATEGORIES.some((c) => c.id === q.category),
        ).length
      : QUESTIONS.filter((q) => q.category === id).length

  const adult = CATEGORIES.find((c) => c.adult)!
  const pickAdult = () => {
    if (adultOk) setCategory(adult.id)
    else setGateOpen(true)
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Hero */}
      <section className="pt-4 pb-10 text-center sm:pt-10 sm:pb-14">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-neon uppercase ring-1 ring-cyan-400/30">
          Hrvatski TV kviz za tvoj ekran
        </p>
        <h1 className="font-display text-5xl leading-none font-black sm:text-7xl md:text-8xl">
          Nitko<span className="text-gold">Sjet</span>
          <span className="text-neon">?</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
          Pitali smo 100 ljudi. Tvoj zadatak je dati{' '}
          <b className="text-foreground">točan</b> odgovor kojeg se sjetilo{' '}
          <b className="text-foreground">najmanje</b> njih. Manje bodova je
          bolje, a{' '}
          <span className="font-bold text-gold">0 bodova = NitkoSjet!</span>
        </p>
        <button
          onClick={() => {
            unlockAudio()
            sfx.click()
            onOpenOnline()
          }}
          className="btn-neon mx-auto mt-7 flex h-14 w-full max-w-md items-center justify-center gap-3 rounded-2xl px-5 font-display text-base font-black tracking-wide uppercase"
        >
          <Globe className="size-5" /> Igraj online s ekipom
          <span className="hidden text-xs font-bold normal-case opacity-80 sm:inline">
            (Kreiraj sobu)
          </span>
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          Bez prijave · prijatelji ulaze preko linka na svojim mobitelima
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
          <button
            onClick={onOpenRules}
            className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 font-semibold ring-1 ring-white/15 hover:bg-white/10"
          >
            <BookOpen className="size-4" /> Pravila igre
          </button>
          <button
            onClick={onOpenLeaderboard}
            className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 font-semibold ring-1 ring-white/15 hover:bg-white/10"
          >
            <Trophy className="size-4 text-gold" /> Ljestvica
            {best !== null && (
              <span className="text-muted-foreground">· rekord {best}</span>
            )}
          </button>
        </div>
      </section>

      <DailyChallenge />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Category */}
        <section className="panel rounded-3xl p-5 sm:p-6">
          <Step n={1} title="Odaberi kategoriju" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {STANDARD_CATEGORIES.map((c) => (
              <CategoryTile
                key={c.id}
                active={category === c.id}
                onClick={() => setCategory(c.id)}
                emoji={c.emoji}
                name={c.name}
                sub={`${counts(c.id)} pitanja · ${c.blurb}`}
              />
            ))}
            <CategoryTile
              active={category === 'mix'}
              onClick={() => setCategory('mix')}
              emoji="🎲"
              name="Sve kategorije"
              sub={`Miks · ${counts('mix')} pitanja`}
              highlight
            />
          </div>
          <button
            onClick={pickAdult}
            aria-pressed={category === adult.id}
            className={cn(
              'mt-2.5 flex w-full items-center gap-3 rounded-2xl bg-rose-950/30 p-3 text-left ring-1 ring-rose-500/30 transition',
              category === adult.id
                ? 'bg-rose-500/15 ring-2 ring-rose-400'
                : 'hover:bg-rose-500/10',
            )}
          >
            <span className="rounded-lg bg-rose-500 px-2 py-1 font-display text-sm font-black text-white">
              18+
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{adult.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {counts(adult.id)} pitanja · {adult.blurb} · nije u Miksu
              </span>
            </span>
            <span className="text-2xl">{adult.emoji}</span>
          </button>
          <AgeGate
            open={gateOpen}
            onCancel={() => setGateOpen(false)}
            onConfirm={() => {
              setGateOpen(false)
              setAdultOk(true)
              savePrefs({ adultConfirmed: true })
              setCategory(adult.id)
            }}
          />
        </section>

        <div className="flex flex-col gap-6">
          {/* Mode */}
          <section className="panel rounded-3xl p-5 sm:p-6">
            <Step n={2} title="Način igre" />
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <ModeCard
                active={mode === 'solo'}
                onClick={() => setMode('solo')}
                icon={<Target className="size-6" />}
                title="Solo izazov"
                text={`${SOLO_ROUNDS} rundi — skupi što manje bodova i obori svoj rekord.`}
              />
              <ModeCard
                active={mode === 'duel'}
                onClick={() => setMode('duel')}
                icon={<Swords className="size-6" />}
                title="Dvoboj 1 na 1"
                text={`2 igrača, ${DUEL_ROUNDS} runde, ${DUEL_LIVES} života. Tko ima više bodova u rundi, gubi život.`}
              />
              <ModeCard
                active={mode === 'teams'}
                onClick={() => setMode('teams')}
                icon={<Users className="size-6" />}
