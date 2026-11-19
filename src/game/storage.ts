import type { RoundFormat } from './trio'
import type { CategoryChoice, Round, TimerSetting } from './types'

export interface LeaderboardEntry {
  name: string
  score: number
  category: CategoryChoice
  timer: TimerSetting
  jackpots: number
  date: string
}

const LB_KEY = 'nitkosjet:leaderboard:v1'
const PREFS_KEY = 'nitkosjet:prefs:v1'
const MAX_ENTRIES = 20

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked — ignore */
  }
}

export function getLeaderboard(): LeaderboardEntry[] {
  return read<LeaderboardEntry[]>(LB_KEY, [])
}

/** Adds the entry and returns its 1-based rank (or null if it didn't make the top list). */
export function addToLeaderboard(entry: LeaderboardEntry): number | null {
  const list = [...getLeaderboard(), entry].sort(
    (a, b) => a.score - b.score || b.jackpots - a.jackpots,
  )
  const trimmed = list.slice(0, MAX_ENTRIES)
  write(LB_KEY, trimmed)
  const rank = trimmed.indexOf(entry)
  return rank === -1 ? null : rank + 1
}

export function clearLeaderboard() {
  write(LB_KEY, [])
}

/** Best (lowest) solo score so far, or null if none. */
export function getPersonalBest(): number | null {
  const list = getLeaderboard()
  return list.length ? Math.min(...list.map((e) => e.score)) : null
}

export interface Prefs {
  muted: boolean
  lastName: string
  category: CategoryChoice
  timer: TimerSetting
  /** Individual player names (duel uses the first 2, free-for-all the first N). */
  players: string[]
  /** Free-for-all player count (3–5). */
  ffaCount: number
  /** Teams mode: [A1, A2, B1, B2]. */
  teamPlayers: string[]
  teamNames: [string, string]
  /** The player confirmed being 18+ on this device. */
  adultConfirmed: boolean
  /** Multiplayer round format. */
  format: RoundFormat
}

const defaultPrefs: Prefs = {
  muted: false,
  lastName: '',
  category: 'mix',
  timer: 30,
  players: ['Igrač 1', 'Igrač 2', 'Igrač 3', 'Igrač 4', 'Igrač 5'],
  ffaCount: 3,
  teamPlayers: ['Igrač A1', 'Igrač A2', 'Igrač B1', 'Igrač B2'],
  teamNames: ['Tim A', 'Tim B'],
  adultConfirmed: false,
  format: 'trio',
}

export function getPrefs(): Prefs {
  const p = { ...defaultPrefs, ...read<Partial<Prefs>>(PREFS_KEY, {}) }
  // Older saves stored only 2 names; pad up to the defaults.
  const pad = (list: unknown, def: string[]) =>
    def.map((d, i) =>
      Array.isArray(list) && typeof list[i] === 'string' ? list[i] : d,
    )
  p.players = pad(p.players, defaultPrefs.players)
  p.teamPlayers = pad(p.teamPlayers, defaultPrefs.teamPlayers)
  p.teamNames = pad(p.teamNames, defaultPrefs.teamNames) as [string, string]
  if (p.format !== 'classic') p.format = 'trio'
  p.ffaCount = Math.min(5, Math.max(3, Number(p.ffaCount) || 3))
  return p
}

export function savePrefs(patch: Partial<Prefs>) {
  write(PREFS_KEY, { ...getPrefs(), ...patch })
}

export const totalFor = (rounds: Round[], player: number) =>
  rounds.reduce(
    (sum, r) =>
      sum +
      r.turns
        .filter((t) => t.player === player)
        .reduce((s, t) => s + t.points, 0),
    0,
  )
