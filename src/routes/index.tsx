import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Trash2, Volume2, VolumeX, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Menu } from '@/components/game/Menu'
import { OnlineEntry } from '@/components/online/OnlineEntry'
import { TrioEntry } from '@/components/game/TrioEntry'
import { TrioReveal, type LocalEntry } from '@/components/game/TrioReveal'
import { DEFAULT_FORMAT, trioSeconds } from '@/game/trio'
import { PlayTurn } from '@/components/game/PlayTurn'
import { RoundSummary } from '@/components/game/RoundSummary'
import { FinalScreen } from '@/components/game/FinalScreen'
import { LeaderboardList } from '@/components/game/Leaderboard'
import {
  DUEL_LIVES,
  FFA_MAX_PLAYERS,
  FFA_MIN_PLAYERS,
  SITE,
  isMultiplayer,
  markPlayed,
  pickQuestions,
  playerColor,
  playerLabel,
  roundSidePoints,
  sideColor,
  sideCount,
  sideName,
  sideOf,
  standings,
  turnOrder,
  usesLives,
} from '@/game/engine'
import { setMuted, sfx, unlockAudio } from '@/game/sound'
import { addPlays, getPlayCounts, getPlayed, setPlayed } from '@/game/session'
import { rotateQuestion } from '@/game/rotate'
import {
  clearLeaderboard,
  getLeaderboard,
  getPrefs,
  savePrefs,
  type LeaderboardEntry,
} from '@/game/storage'
import type { GameConfig, Round, Turn } from '@/game/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { soba?: string } => {
    const soba =
      typeof search.soba === 'string' ? search.soba.trim().toUpperCase() : ''
    return /^[A-Z0-9]{4,6}$/.test(soba) ? { soba } : {}
  },
  component: Home,
})

type Phase =
  | 'menu'
  | 'online'
  | 'handoff'
  | 'turn'
  | 'trioEntry'
  | 'trioReveal'
  | 'summary'
  | 'final'

interface Game {
  config: GameConfig
  rounds: Round[]
  roundIdx: number
  turnIdx: number
  lives: number[]
  /** Finale format: locked answers per player for the current round. */
  entries: Record<number, LocalEntry>
}

/** Multiplayer games use the 3-answer Finale format unless classic was chosen. */
const isTrioGame = (config: GameConfig) =>
  isMultiplayer(config) && (config.format ?? DEFAULT_FORMAT) === 'trio'

/** Pick questions not yet played in this browser session. */
function pickFresh(config: GameConfig) {
  const played = getPlayed()
  const counts = getPlayCounts()
  const questions = pickQuestions(config, played)
  setPlayed(markPlayed(played, questions))
  addPlays(questions.map((q) => q.id))
  // Anti-cheat: a repeated question gets a different 0-point answer.
  return questions.map((q) => rotateQuestion(q, counts[q.id] ?? 0))
}

function newGame(config: GameConfig): Game {
  return {
    config,
    rounds: pickFresh(config).map((question) => ({ question, turns: [] })),
    roundIdx: 0,
    turnIdx: 0,
    lives: usesLives(config)
      ? Array.from({ length: sideCount(config) }, () => DUEL_LIVES)
      : [],
    entries: {},
  }
}

function Home() {
  const { soba } = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const [phase, setPhase] = useState<Phase>('menu')
  const [game, setGame] = useState<Game | null>(null)
  const [muted, setMutedState] = useState(false)
  const [lbOpen, setLbOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [board, setBoard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    const m = getPrefs().muted
    setMutedState(m)
    setMuted(m)
  }, [])

  useEffect(() => {
    if (lbOpen) setBoard(getLeaderboard())
  }, [lbOpen])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [phase, game?.roundIdx, game?.turnIdx])

  const toggleMute = () => {
    const m = !muted
    setMutedState(m)
    setMuted(m)
    savePrefs({ muted: m })
    if (!m) {
      unlockAudio()
      sfx.click()
    }
  }

  const start = (config: GameConfig) => {
    setGame(newGame(config))
    setPhase(isMultiplayer(config) ? 'handoff' : 'turn')
  }

  const onTurnComplete = (turn: Turn) => {
    if (!game) return
    const rounds = game.rounds.map((r, i) =>
      i === game.roundIdx ? { ...r, turns: [...r.turns, turn] } : r,
    )
    const order = turnOrder(game.config, game.roundIdx)
    if (game.turnIdx + 1 < order.length) {
      setGame({ ...game, rounds, turnIdx: game.turnIdx + 1 })
      setPhase('handoff')
      return
    }
    finishRound(game, rounds)
  }

  /** Finale: a player locked their 3 answers. */
  const onTrioLocked = (entry: LocalEntry) => {
    if (!game) return
    const order = turnOrder(game.config, game.roundIdx)
    const entries = { ...game.entries, [order[game.turnIdx]]: entry }
    if (game.turnIdx + 1 < order.length) {
      setGame({ ...game, entries, turnIdx: game.turnIdx + 1 })
      setPhase('handoff')
    } else {
      setGame({ ...game, entries })
      setPhase('trioReveal')
    }
  }

  const onTrioRevealed = (turns: Turn[]) => {
    if (!game) return
    const rounds = game.rounds.map((r, i) =>
      i === game.roundIdx ? { ...r, turns } : r,
    )
    finishRound(game, rounds)
  }

  /** Lives and summary once everybody has answered. */
  const finishRound = (game: Game, rounds: Round[]) => {
    const lives = [...game.lives]
    if (usesLives(game.config)) {
      const round = rounds[game.roundIdx]
      const pts = Array.from({ length: sideCount(game.config) }, (_, side) =>
        roundSidePoints(game.config, round, side),
      )
      const max = Math.max(...pts)
      // Only a single highest score loses a life; a tie at the top spares everyone.
      const loser =
        pts.filter((p) => p === max).length === 1 ? pts.indexOf(max) : null
      round.loser = loser
      if (loser !== null) {
        lives[loser] -= 1
        setTimeout(() => sfx.lifeLost(), 250)
      }
    }
    setGame({ ...game, rounds, lives })
    setPhase('summary')
  }

  const isLastRound = (g: Game) =>
    g.roundIdx + 1 >= g.rounds.length ||
    (usesLives(g.config) && g.lives.some((l) => l <= 0))

  const nextRound = () => {
    if (!game) return
    sfx.click()
    if (isLastRound(game)) {
      // Drop unplayed rounds (duel can end early).
      setGame({
        ...game,
        rounds: game.rounds.filter((r) => r.turns.length > 0),
      })
      setPhase('final')
      return
    }
    setGame({ ...game, roundIdx: game.roundIdx + 1, turnIdx: 0, entries: {} })
    setPhase(isMultiplayer(game.config) ? 'handoff' : 'turn')
  }

  const round = game?.rounds[game.roundIdx]
  const player = game ? turnOrder(game.config, game.roundIdx)[game.turnIdx] : 0

  const online = !!soba || phase === 'online'
  const exitOnline = () => {
    setPhase('menu')
    setGame(null)
    if (soba) navigate({ search: {} })
  }

  return (
    <div className="stage flex flex-col">
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <button
          onClick={() => {
            if (online) {
              exitOnline()
              return
            }
            if (
              phase !== 'menu' &&
              phase !== 'final' &&
              !confirm('Prekinuti igru i vratiti se u izbornik?')
            )
              return
            setPhase('menu')
            setGame(null)
          }}
          className="font-display text-lg font-black tracking-tight"
          aria-label="NitkoSjet — početna"
        >
          Nitko<span className="text-gold">Sjet</span>
          <span className="ml-1 text-xs font-medium text-muted-foreground">
            .fun
          </span>
        </button>
        <div className="flex items-center gap-2">
          {game && phase !== 'menu' && usesLives(game.config) && (
            <LivesBar game={game} />
          )}
          {game && phase !== 'menu' && game.config.mode === 'ffa' && (
            <LeaderChip game={game} />
          )}
          {game && phase !== 'menu' && game.config.mode === 'solo' && (
            <span className="rounded-full bg-white/5 px-3 py-1 text-sm font-semibold ring-1 ring-white/10">
              Ukupno:{' '}
              <span className="font-display text-neon tabular-nums">
                {game.rounds.reduce(
                  (s, r) => s + r.turns.reduce((a, t) => a + t.points, 0),
                  0,
                )}
              </span>
            </span>
          )}
          <button
            onClick={toggleMute}
            className="flex size-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
            aria-label={muted ? 'Uključi zvuk' : 'Isključi zvuk'}
            title={muted ? 'Uključi zvuk' : 'Isključi zvuk'}
          >
            {muted ? (
              <VolumeX className="size-5" />
            ) : (
              <Volume2 className="size-5" />
            )}
          </button>
        </div>
      </header>

      <main className="relative z-0 flex-1 px-4 pb-10 sm:px-6">
        {online && (
          <OnlineEntry
            code={soba}
            onCodeChange={(code) =>
              navigate({ search: code ? { soba: code } : {}, replace: true })
            }
            onExit={exitOnline}
          />
        )}

        {!online && phase === 'menu' && (
          <Menu
            onStart={start}
            onOpenLeaderboard={() => setLbOpen(true)}
            onOpenRules={() => setRulesOpen(true)}
            onOpenOnline={() => setPhase('online')}
          />
        )}

        {phase === 'handoff' && game && round && (
          <div className="mx-auto mt-10 max-w-md text-center sm:mt-20">
            <p className="font-display text-xs tracking-[0.25em] text-muted-foreground uppercase">
              Runda {game.roundIdx + 1}/{game.rounds.length}
            </p>
            <p className="mt-6 text-muted-foreground">Uređaj predaj igraču</p>
            <p
              className={cn(
                'animate-pop font-display text-4xl font-black break-words sm:text-5xl',
                playerColor(game.config, player).text,
              )}
            >
              {game.config.players[player]}
            </p>
            {game.config.mode === 'teams' && (
              <p
                className={cn(
                  'mt-1 font-bold',
                  playerColor(game.config, player).text,
                )}
              >
                {sideName(game.config, sideOf(game.config, player))}
              </p>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              {isTrioGame(game.config)
                ? 'Upiši tajno svoja 3 odgovora — ostali neka ne gledaju!'
                : game.turnIdx === 0
                  ? 'Ti otvaraš ovu rundu.'
                  : game.turnIdx === 1
                    ? 'Odgovor prethodnog igrača je iskorišten — moraš smisliti drugi.'
                    : 'Odgovori koji su već dani u ovoj rundi su iskorišteni — moraš smisliti drugi.'}
              {game.config.timer > 0 &&
                ` Tajmer od ${isTrioGame(game.config) ? trioSeconds(game.config.timer) : game.config.timer} s kreće kad klikneš.`}
            </p>
            <button
              onClick={() => {
                unlockAudio()
                sfx.click()
                setPhase(isTrioGame(game.config) ? 'trioEntry' : 'turn')
              }}
              autoFocus
              className="btn-gold mt-8 h-14 w-full rounded-2xl font-display text-lg font-black uppercase"
            >
              Spreman/na sam!
            </button>
          </div>
        )}

        {phase === 'trioEntry' && game && round && (
          <TrioEntry
            key={`${game.roundIdx}-${game.turnIdx}`}
            question={round.question}
            playerName={playerLabel(game.config, player)}
            playerChip={playerColor(game.config, player).chip}
            timer={game.config.timer}
            roundNumber={game.roundIdx + 1}
            totalRounds={game.rounds.length}
            onLocked={onTrioLocked}
          />
        )}

        {phase === 'trioReveal' && game && round && (
          <TrioReveal
            key={game.roundIdx}
            question={round.question}
            config={game.config}
            order={turnOrder(game.config, game.roundIdx)}
            entries={game.entries}
            roundNumber={game.roundIdx + 1}
            totalRounds={game.rounds.length}
            onDone={onTrioRevealed}
          />
        )}

        {phase === 'turn' && game && round && (
          <PlayTurn
            key={`${game.roundIdx}-${game.turnIdx}`}
            question={round.question}
            roundNumber={game.roundIdx + 1}
            totalRounds={game.rounds.length}
            player={player}
            playerName={
              isMultiplayer(game.config)
                ? playerLabel(game.config, player)
                : undefined
            }
            playerChip={playerColor(game.config, player).chip}
            timer={game.config.timer}
            takenAnswers={round.turns
              .map((t) => t.answerIndex)
              .filter((i): i is number => i !== null)}
            takenNovels={round.turns
              .map((t) => t.novel)
              .filter((n): n is string => !!n)}
            onComplete={onTurnComplete}
          />
        )}

        {phase === 'summary' && game && round && (
          <RoundSummary
            round={round}
            roundNumber={game.roundIdx + 1}
            totalRounds={game.rounds.length}
            config={game.config}
            lives={game.lives}
            maxLives={DUEL_LIVES}
            isLast={isLastRound(game)}
            played={game.rounds.filter((r) => r.turns.length > 0)}
            onNext={nextRound}
          />
        )}

        {phase === 'final' && game && (
          <FinalScreen
            config={game.config}
            rounds={game.rounds}
            lives={game.lives}
            onReplay={() => start(game.config)}
            onMenu={() => {
              setPhase('menu')
              setGame(null)
            }}
          />
        )}
      </main>

      <footer className="relative z-0 px-4 pb-6 text-center text-xs text-muted-foreground/70">
        {SITE} · Kviz inspiriran TV formatom u kojem pobjeđuje odgovor kojeg se
        nitko nije sjetio. Bodovi su ilustrativni rezultati ankete od 100
        ispitanika.
      </footer>

      <Dialog open={lbOpen} onOpenChange={setLbOpen}>
        <DialogContent className="panel max-h-[85dvh] overflow-y-auto border-white/10 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              🏆 Lokalna ljestvica
            </DialogTitle>
            <DialogDescription>
              Najbolji Solo izazovi na ovom uređaju — najmanje bodova je na
              vrhu.
            </DialogDescription>
          </DialogHeader>
          <LeaderboardList entries={board} limit={20} />
          {board.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Obrisati cijelu ljestvicu na ovom uređaju?')) {
                  clearLeaderboard()
                  setBoard([])
                }
              }}
              className="mt-2 inline-flex items-center gap-1.5 self-start text-xs font-semibold text-muted-foreground hover:text-rose-400"
            >
              <Trash2 className="size-3.5" /> Obriši ljestvicu
            </button>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="panel max-h-[85dvh] overflow-y-auto border-white/10 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              Kako se igra NitkoSjet?
            </DialogTitle>
            <DialogDescription>Manje je više. Puno više.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm leading-relaxed">
            <li>
              <b className="text-neon">1. Pitanje ima puno točnih odgovora.</b>{' '}
              Pitali smo 100 ljudi da u 100 sekundi nabroje što više njih.
            </li>
            <li>
              <b className="text-neon">2. Bodovi = koliko ih se sjetilo.</b>{' '}
              Poznati odgovori nose 70–95 bodova, srednje poznati 20–50, a
              opskurni 0–5.
            </li>
            <li>
              <b className="text-gold">3. Cilj je što manje bodova.</b> Točan
              odgovor kojeg se nitko nije sjetio nosi 0 bodova — to je{' '}
              <b className="text-gold">NitkoSjet!</b>
            </li>
            <li>
              <b className="text-rose-400">4. Netočan odgovor = 100 bodova.</b>{' '}
              Isto vrijedi ako istekne vrijeme.
            </li>
            <li>
              <b>Solo izazov:</b> 5 rundi, zbroj bodova ide na lokalnu
              ljestvicu.
            </li>
            <li>
              <b>Dvoboj:</b> dva igrača na istom uređaju, 3 runde i 2 života. U
              svakoj rundi oboje odgovaraju na isto pitanje (isti odgovor ne
              vrijedi dvaput), a tko ima više bodova gubi život.
            </li>
            <li>
              <b>Timovi 2 na 2:</b> četiri igrača u dva tima, 3 runde i 2 života
              po timu. Svi odgovaraju redom na isto pitanje, bodovi članova tima
              se zbrajaju, a tim s više bodova gubi život.
            </li>
            <li>
              <b>Svatko za sebe:</b> {FFA_MIN_PLAYERS}–{FFA_MAX_PLAYERS} igrača,
              3 runde. Svi odgovaraju na isto pitanje, a pobjeđuje onaj s
              najmanjim ukupnim zbrojem bodova.
            </li>
            <li>
              <b>Online s ekipom:</b> kreiraj sobu, pošalji link i svatko igra
              na svom mobitelu — bez prijave. Svi vide isti TV studio i stupac
              bodova, a pobjeđuje najmanji zbroj.
            </li>
            <li>
              <b className="text-rose-400">18+ Bezobrazno:</b> pitanja samo za
              odrasle. Bira se posebno, uz potvrdu dobi, i nikad nije dio Miksa.
            </li>
            <li className="text-muted-foreground">
              Velika i mala slova, kvačice (č, ć, ž, š, đ) i sitni tipfeleri
              nisu bitni. Prihvaćamo i uobičajene varijante imena (npr. engleske
              nazive ili samo prezime).
            </li>
            <li className="text-muted-foreground">
              <b className="text-neon">⚖️ AI sudac:</b> ako odgovor nije
              doslovno na popisu, strogi sudac provjerava smisao cijelog
              odgovora. Isto značenje i pravi sleng vrijede kao odgovor iz
              ankete, a stvaran odgovor kojeg nema u anketi dobiva 0–20 bodova.
              Osobna imena, trolanje i besmislice dobivaju 100 bodova.
            </li>
            <li className="text-muted-foreground">
              Pitanja se ne ponavljaju dok ne odigraš cijelu kategoriju. Kad se
              pitanje ipak ponovi, odgovor za 0 bodova se promijeni — pamćenje
              ne pomaže!
            </li>
          </ol>
          <button
            onClick={() => setRulesOpen(false)}
            className="btn-neon mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl font-bold"
          >
            <X className="size-4" /> Jasno, idemo!
          </button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LivesBar({ game }: { game: Game }) {
  const n = sideCount(game.config)
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-bold ring-1 ring-white/10 sm:text-sm">
      {Array.from({ length: n }, (_, side) => (
        <span
          key={side}
          className={cn('flex items-center gap-1', sideColor(side).text)}
        >
          <span className="max-w-16 truncate sm:max-w-28">
            {sideName(game.config, side)}
          </span>
          <span aria-label={`${game.lives[side]} života`}>
            {'❤️'.repeat(Math.max(0, game.lives[side]))}
            {'🖤'.repeat(Math.max(0, DUEL_LIVES - game.lives[side]))}
          </span>
        </span>
      ))}
    </div>
  )
}

/** Free-for-all: shows who currently has the lowest total. */
function LeaderChip({ game }: { game: Game }) {
  const played = game.rounds.filter((r) => r.turns.length > 0)
  if (played.length === 0) return null
  const [first] = standings(game.config, played, game.lives)
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold ring-1 ring-white/10 sm:text-sm">
      Vodi:
      <span
        className={cn(
          'max-w-24 truncate font-bold sm:max-w-36',
          sideColor(first.side).text,
        )}
      >
        {sideName(game.config, first.side)}
      </span>
      <span className="font-display text-neon tabular-nums">{first.total}</span>
    </span>
  )
}
