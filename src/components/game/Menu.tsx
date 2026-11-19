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
                title="Timovi 2 na 2"
                text={`${TEAM_ROUNDS} runde, ${DUEL_LIVES} života po timu. Zbrajaju se bodovi oba člana tima.`}
              />
              <ModeCard
                active={mode === 'ffa'}
                onClick={() => setMode('ffa')}
                icon={<PartyPopper className="size-6" />}
                title="Svatko za sebe"
                text={`${FFA_MIN_PLAYERS}–${FFA_MAX_PLAYERS} igrača, ${FFA_ROUNDS} runde. Najmanji zbroj bodova pobjeđuje.`}
              />
            </div>
            {(mode === 'duel' || mode === 'ffa') && (
              <div className="mt-4">
                {mode === 'ffa' && (
                  <div
                    className="mb-3 flex items-center gap-2"
                    role="group"
                    aria-label="Broj igrača"
                  >
                    <span className="mr-1 text-sm font-semibold text-muted-foreground">
                      Igrača:
                    </span>
                    {Array.from(
                      { length: FFA_MAX_PLAYERS - FFA_MIN_PLAYERS + 1 },
                      (_, i) => FFA_MIN_PLAYERS + i,
                    ).map((n) => (
                      <button
                        key={n}
                        onClick={() => setFfaCount(n)}
                        aria-pressed={ffaCount === n}
                        className={cn(
                          'size-10 rounded-xl bg-black/25 font-display font-bold ring-1 ring-white/10 transition',
                          ffaCount === n
                            ? 'neon-ring bg-cyan-400/10 text-neon'
                            : 'hover:bg-white/5',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {Array.from(
                    { length: mode === 'duel' ? 2 : ffaCount },
                    (_, i) => (
                      <NameInput
                        key={i}
                        label={`Igrač ${i + 1}`}
                        labelClass={sideColor(i).text}
                        value={players.at(i) ?? ''}
                        onChange={(v) => {
                          const next = [...players]
                          next.splice(i, 1, v)
                          setPlayers(next)
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
            )}
            {mode === 'teams' && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Array.from({ length: 2 }, (_, t) => (
                  <div
                    key={t}
                    className="space-y-2 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10"
                  >
                    <NameInput
                      label="Ime tima"
                      labelClass={sideColor(t).text}
                      value={teamNames.at(t) ?? ''}
                      onChange={(v) => {
                        const next: [string, string] = [
                          teamNames.at(0) ?? 'Tim A',
                          teamNames.at(1) ?? 'Tim B',
                        ]
                        next.splice(t, 1, v)
                        setTeamNames(next)
                      }}
                    />
                    {Array.from({ length: 2 }, (_, m) => (
                      <NameInput
                        key={m}
                        label={`Igrač ${m + 1}`}
                        labelClass="text-muted-foreground"
                        value={teamPlayers.at(t * 2 + m) ?? ''}
                        onChange={(v) => {
                          const next = [...teamPlayers]
                          next.splice(t * 2 + m, 1, v)
                          setTeamPlayers(next)
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
            {mode !== 'solo' && (
              <div className="mt-4">
                <FormatPicker value={format} onChange={setFormat} />
              </div>
            )}
          </section>

          <section className="panel rounded-3xl p-5 sm:p-6">
            <Step n={3} title="Tempo" />
            <div className="grid grid-cols-3 gap-2">
              {TIMERS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTimer(t.value)}
                  aria-pressed={timer === t.value}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl bg-black/25 px-2 py-3 text-center ring-1 ring-white/10 transition',
                    timer === t.value
                      ? 'neon-ring bg-cyan-400/10'
                      : 'hover:bg-white/5',
                  )}
                >
                  <t.icon
                    className={cn('size-5', timer === t.value && 'text-neon')}
                  />
                  <span className="text-sm font-bold">{t.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t.sub}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-8 bg-gradient-to-t from-[#07061a] via-[#07061a]/90 to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:bg-none sm:p-0">
        <button
          onClick={start}
          className="btn-gold mx-auto flex h-16 w-full max-w-md items-center justify-center gap-3 rounded-2xl font-display text-lg font-black tracking-wide uppercase"
        >
          <Play className="size-6 fill-current" /> Kreni u igru
        </button>
      </div>
    </div>
  )
}

function NameInput({
  label,
  labelClass,
  value,
  onChange,
}: {
  label: string
  labelClass: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block min-w-0">
      <span className={cn('mb-1 block text-xs font-bold', labelClass)}>
        {label}
      </span>
      <input
        value={value}
        maxLength={16}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/30 px-3 font-semibold focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 focus:outline-none"
      />
    </label>
  )
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 font-display text-base font-bold">
      <span className="flex size-7 items-center justify-center rounded-full bg-cyan-400/15 text-sm text-neon ring-1 ring-cyan-400/40">
        {n}
      </span>
      {title}
    </h2>
  )
}

function CategoryTile({
  active,
  onClick,
  emoji,
  name,
  sub,
  highlight,
}: {
  active: boolean
  onClick: () => void
  emoji: string
  name: string
  sub: string
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex min-h-24 flex-col items-start justify-between rounded-2xl bg-black/25 p-3 text-left ring-1 ring-white/10 transition',
        active
          ? highlight
            ? 'gold-ring bg-amber-300/10'
            : 'neon-ring bg-cyan-400/10'
          : 'hover:bg-white/5',
        highlight && !active && 'ring-amber-300/30',
      )}
    >
      <span className="text-2xl transition group-hover:scale-110">{emoji}</span>
      <span>
        <span className="block text-sm leading-tight font-bold">{name}</span>
        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted-foreground">
          {sub}
        </span>
      </span>
    </button>
  )
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  text,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-start gap-3 rounded-2xl bg-black/25 p-4 text-left ring-1 ring-white/10 transition',
        active ? 'neon-ring bg-cyan-400/10' : 'hover:bg-white/5',
      )}
    >
      <span
        className={cn('mt-0.5', active ? 'text-neon' : 'text-muted-foreground')}
      >
        {icon}
      </span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  )
}
