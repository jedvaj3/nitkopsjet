import {
  QUESTIONS,
  STANDARD_CATEGORIES,
  categoryName,
  isAdultCategory,
} from './questions'
import { totalFor } from './storage'
import { answerLabel } from './meaning'
import type { CategoryId, GameConfig, GameMode, Question, Round } from './types'

export const SOLO_ROUNDS = 5
export const DUEL_ROUNDS = 3
export const DUEL_LIVES = 2
export const TEAM_ROUNDS = 3
export const FFA_ROUNDS = 3
export const FFA_MIN_PLAYERS = 3
export const FFA_MAX_PLAYERS = 5
export const WRONG_POINTS = 100
export const SITE = 'nitkosjet.fun'

const SEEN_STORAGE_KEY = 'nitkosjet_seen_questions_v1'

function loadPersistedPlayed(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set()
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set()
  } catch {
    return new Set()
  }
}

function savePersistedPlayed(played: Set<string>) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...played]))
  } catch {
    // ignore storage errors
  }
}

export const roundsFor = (mode: GameMode) =>
  mode === 'solo'
    ? SOLO_ROUNDS
    : mode === 'duel'
      ? DUEL_ROUNDS
      : mode === 'teams'
        ? TEAM_ROUNDS
        : FFA_ROUNDS

/** Modes where the side with more points in a round loses a life. */
export const usesLives = (config: GameConfig) =>
  config.mode === 'duel' || config.mode === 'teams'

export const isMultiplayer = (config: GameConfig) => config.mode !== 'solo'

export const sideCount = (config: GameConfig) =>
  config.mode === 'teams' ? 2 : config.players.length

export const sideOf = (config: GameConfig, player: number) =>
  config.mode === 'teams' ? player % 2 : player

export const sideName = (config: GameConfig, side: number) =>
  config.mode === 'teams'
    ? (config.teams?.[side] ?? `Tim ${side === 0 ? 'A' : 'B'}`)
    : config.players[side]

export const sideMembers = (config: GameConfig, side: number) =>
  config.players.map((_, p) => p).filter((p) => sideOf(config, p) === side)

/** Turn order for a round: seats rotate so a different player opens each round. */
export function turnOrder(config: GameConfig, roundIdx: number): number[] {
  const n = config.players.length
  return Array.from({ length: n }, (_, i) => (i + roundIdx) % n)
}

/** Points a side scored in a single round. */
export const roundSidePoints = (
  config: GameConfig,
  round: Round,
  side: number,
) =>
  round.turns
    .filter((t) => sideOf(config, t.player) === side)
    .reduce((s, t) => s + t.points, 0)

export const sideTotal = (config: GameConfig, rounds: Round[], side: number) =>
  rounds.reduce((s, r) => s + roundSidePoints(config, r, side), 0)

export interface Standing {
  side: number
  total: number
  lives: number
  place: number
}

/** Ranking: more lives first (lives modes), then the lower total. */
export function standings(
  config: GameConfig,
  rounds: Round[],
  lives: number[],
): Standing[] {
  const withLives = usesLives(config)
  const rows = Array.from({ length: sideCount(config) }, (_, side) => ({
    side,
    total: sideTotal(config, rounds, side),
    lives: withLives ? (lives[side] ?? 0) : 0,
    place: 0,
  }))
  rows.sort((a, b) => b.lives - a.lives || a.total - b.total)
  rows.forEach((r, i) => {
    const prev = rows[i - 1]
    r.place =
      prev && prev.lives === r.lives && prev.total === r.total
        ? prev.place
        : i + 1
  })
  return rows
}

export const SIDE_COLORS = [
  {
    text: 'text-cyan-300',
    chip: 'bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/40',
  },
  {
    text: 'text-fuchsia-300',
    chip: 'bg-fuchsia-400/15 text-fuchsia-300 ring-1 ring-fuchsia-400/40',
  },
  {
    text: 'text-amber-300',
    chip: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40',
  },
  {
    text: 'text-emerald-300',
    chip: 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40',
  },
  {
    text: 'text-orange-300',
    chip: 'bg-orange-400/15 text-orange-300 ring-1 ring-orange-400/40',
  },
] as const

export const sideColor = (side: number) =>
  SIDE_COLORS[side % SIDE_COLORS.length]
export const playerColor = (config: GameConfig, player: number) =>
  sideColor(sideOf(config, player))

export const playerLabel = (config: GameConfig, player: number) =>
  config.mode === 'teams'
    ? `${config.players[player]} (${sideName(config, sideOf(config, player))})`
    : config.players[player]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function freshFirst(pool: Question[], count: number, played: Set<string>) {
  const fresh = shuffle(pool.filter((q) => !played.has(q.id)))
  if (fresh.length >= count) return fresh
  const again = shuffle(pool.filter((q) => played.has(q.id)))
  return [...fresh, ...again]
}

export function pickFromCategories(
  categories: CategoryId[],
  count: number,
  played: Set<string> = new Set(),
): Question[] {
  const mergedPlayed = new Set([...loadPersistedPlayed(), ...played])
  const wanted = new Set(
    categories.length ? categories : STANDARD_CATEGORIES.map((c) => c.id),
  )
  const pool = freshFirst(
    QUESTIONS.filter((q) => wanted.has(q.category)),
    count,
    mergedPlayed,
  )
  const picked: Question[] = []
  const seen = new Set<string>()
  for (const q of pool) {
    if (picked.length >= count) break
    if (!seen.has(q.category) && !mergedPlayed.has(q.id)) {
      picked.push(q)
      seen.add(q.category)
    }
  }
  for (const q of pool) {
    if (picked.length >= count) break
    if (!picked.includes(q)) picked.push(q)
  }
  if (picked.length < count) {
    const rest = freshFirst(
      QUESTIONS.filter(
        (q) => !picked.includes(q) && !isAdultCategory(q.category),
      ),
      count - picked.length,
      mergedPlayed,
    )
    picked.push(...rest.slice(0, count - picked.length))
  }
  const result = shuffle(picked)
  const updated = markPlayed(mergedPlayed, result)
  savePersistedPlayed(updated)
  return result
}

export function markPlayed(
  played: Set<string>,
  picked: Question[],
): Set<string> {
  const merged = new Set([...loadPersistedPlayed(), ...played])
  const exhausted = new Set(
    picked.filter((q) => merged.has(q.id)).map((q) => q.category),
  )
  const byId = new Map(QUESTIONS.map((q) => [q.id, q]))
  const next = new Set(
    [...merged].filter(
      (id) => !exhausted.has(byId.get(id)?.category as CategoryId),
    ),
  )
  for (const q of picked) next.add(q.id)
  savePersistedPlayed(next)
  return next
}

/** Pick questions for a local game. The mix never includes 18+ questions. */
export function pickQuestions(
  config: GameConfig,
  played: Set<string> = new Set(),
): Question[] {
  const count = roundsFor(config.mode)
  if (config.category === 'mix') return pickFromCategories([], count, played)
  return pickFromCategories([config.category], count, played)
}

export const lowestAnswers = (q: Question, max = 6) => {
  const sorted = [...q.answers].sort((a, b) => a.points - b.points)
  const gems = sorted.filter((a) => a.points <= 5)
  return (gems.length >= 3 ? gems : sorted.slice(0, 3)).slice(0, max)
}

const emojiFor = (points: number) =>
  points === 0
    ? '🏆'
    : points <= 10
      ? '🟨'
      : points <= 40
        ? '🟦'
        : points < 100
          ? '🟪'
          : '❌'

export function buildShareText(config: GameConfig, rounds: Round[]): string {
  const timer = config.timer ? `⏱️ ${config.timer} s` : 'opušteno'
  const lines: string[] = []
  if (config.mode === 'solo') {
    const total = totalFor(rounds, 0)
    lines.push(`🎯 NitkoSjet — Solo izazov`)
    lines.push(`${categoryName(config.category)} · ${timer}`)
    lines.push('')
    rounds.forEach((r, i) => {
      const t = r.turns[0]
      const label = answerLabel(r.question, t) ?? 'promašaj'
      lines.push(
        `${emojiFor(t.points)} R${i + 1}: ${String(t.points).padStart(3, ' ')} — ${label}${t.points === 0 ? ' NITKOSJET!' : ''}`,
      )
    })
    lines.push('')
    lines.push(`Ukupno: ${total} bodova (manje je bolje!)`)
  } else {
    const n = sideCount(config)
    const names = Array.from({ length: n }, (_, i) => sideName(config, i))
    const title =
      config.mode === 'duel'
        ? `⚔️ NitkoSjet — Dvoboj: ${names.join(' vs ')}`
        : config.mode === 'teams'
          ? `👥 NitkoSjet — Timovi: ${names.join(' vs ')}`
          : `🎉 NitkoSjet — Svatko za sebe (${n} igrača)`
    lines.push(title)
    lines.push(`${categoryName(config.category)} · ${timer}`)
    lines.push('')
    rounds.forEach((r, i) => {
      const parts = names.map((name, side) => {
        const pts = roundSidePoints(config, r, side)
        const emoji = config.mode === 'teams' ? '' : `${emojiFor(pts)} `
        return `${name} ${emoji}${pts}`
      })
      lines.push(`R${i + 1}: ${parts.join('  ·  ')}`)
    })
    lines.push('')
    lines.push(
      `Ukupno: ${names.map((name, side) => `${name} ${sideTotal(config, rounds, side)}`).join(' · ')}`,
    )
  }
  lines.push(`Možeš li bolje? 👉 https://${SITE}`)
  return lines.join('\n')
}

export async function shareText(
  text: string,
): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      /Mobi|Android/i.test(navigator.userAgent)
    ) {
      await navigator.share({ title: 'NitkoSjet', text })
      return 'shared'
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'failed'
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok ? 'copied' : 'failed'
  }
}

/** Croatian plural for "bod": 1 bod, 2–4 boda, 5+ bodova (21 bod, 22 boda…). */
export function bodova(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'bod'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'boda'
  return 'bodova'
}
