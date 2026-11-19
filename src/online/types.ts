import type { CategoryId } from '@/game/types'
import type { RoundFormat } from '@/game/trio'

export const ROOM_MAX_PLAYERS = 8
export const ROOM_ROUND_OPTIONS = [3, 5, 7, 10] as const
export const ROOM_TIMER_OPTIONS = [20, 30, 45, 60] as const
export const ROOM_CODE_LENGTH = 4
export const POLL_MS = 1600

export interface RoomSettings {
  /** Empty = all standard categories (the mix). May include the 18+ category. */
  categories: CategoryId[]
  rounds: number
  /** Seconds per answer. */
  timer: number
  /** 3 answers per player revealed in rounds (default), or 1 answer in turn. */
  format: RoundFormat
}

/**
 * classic: turn → reveal → … → summary. trio: input (everyone writes 3) →
 * reveal / replace (one answer at a time) → … → summary.
 */
export type RoomPhase =
  'lobby' | 'turn' | 'input' | 'reveal' | 'replace' | 'summary' | 'final'

// ───────────── Server-side (stored) state ─────────────

export interface RoomPlayer {
  id: string
  token: string
  name: string
  avatar: number
  joinedAt: number
  lastSeen: number
}

export interface RoomTurn {
  playerId: string
  input: string
  answerIndex: number | null
  points: number
  timedOut: boolean
  /** Room event number when this turn was played; used as an animation key. */
  seq: number
  novel?: string
  judge?: 'baza' | 'ai' | 'rezerva'
  reason?: string
  /** Trio format: which of the player's 3 answers this is (0–2). */
  slot?: number
  /** Answer time in ms (titles). */
  ms?: number
}

/** A locked (judged, not yet revealed) trio answer. */
export interface TrioEntry {
  ms?: number
  input: string
  answerIndex: number | null
  points: number
  novel?: string
  judge?: 'baza' | 'ai' | 'rezerva'
  reason?: string
}

export interface RoomRound {
  questionId: string
  /** Anti-cheat rotation (times this question was played before in the room). */
  variant?: number
  /** Player ids in answering order for this round. */
  order: string[]
  turns: RoomTurn[]
  /** Trio: locked answers per player id (hidden from clients until revealed). */
  entries?: Record<string, TrioEntry[]>
  /** Trio: position in the reveal sequence. */
  revealIdx?: number
  /** Trio: a player must replace an answer someone already gave. */
  replacing?: {
    playerId: string
    slot: number
    input: string
    duplicate: string
  }
}

export interface RoomState {
  code: string
  hostId: string
  createdAt: number
  /** Increments on every game event. */
  seq: number
  /** Increments with every new game in this room. */
  game: number
  settings: RoomSettings
  players: RoomPlayer[]
  phase: RoomPhase
  rounds: RoomRound[]
  roundIdx: number
  turnIdx: number
  /** Turn deadline (ms epoch) while phase is `turn`. */
  deadline: number | null
  /** When `reveal` / `summary` automatically moves on. */
  phaseUntil: number | null
  /** Question ids already played in this room (no repeats until the pool runs out). */
  played?: string[]
  /** Recent emoji reactions (kept for a few seconds). */
  reactions?: Reaction[]
  reactionSeq?: number
  /** How often each question was played in this room (drives the rotation). */
  playCounts?: Record<string, number>
}

// ───────────── What clients receive ─────────────

export interface PublicPlayer {
  id: string
  name: string
  avatar: number
  online: boolean
  total: number
}

export interface PublicTurn {
  playerId: string
  input: string
  answerText: string | null
  points: number
  timedOut: boolean
  seq: number
  slot?: number
  ms?: number
  /** Accepted by the AI judge although not in the answer list. */
  novel?: boolean
  judge?: 'baza' | 'ai' | 'rezerva'
  reason?: string
}

export interface PublicRound {
  question: { id: string; text: string; hint?: string; category: CategoryId }
  order: string[]
  turns: PublicTurn[]
  /** Full answer list, only once the round is over. */
  answers?: { text: string; points: number }[]
}

export interface PublicRoom {
  code: string
  hostId: string
  seq: number
  game: number
  settings: RoomSettings
  players: PublicPlayer[]
  phase: RoomPhase
  roundIdx: number
  totalRounds: number
  turnIdx: number
  currentPlayerId: string | null
  deadline: number | null
  phaseUntil: number | null
  /** Server clock, so clients can correct their countdowns. */
  now: number
  rounds: PublicRound[]
  lastTurn: PublicTurn | null
  /** Trio: players who have locked their 3 answers this round. */
  locked: string[]
  /** Trio: the duplicate being replaced right now. */
  replacing: {
    playerId: string
    slot: number
    input: string
    duplicate: string
  } | null
  /** Trio: which slot (0–2) is being revealed. */
  revealSlot: number | null
  /** Emoji reactions from the last few seconds. */
  reactions: Reaction[]
}

export const REACTIONS = ['😂', '🔥', '💀', '🤡', '🤫'] as const
export type ReactionEmoji = (typeof REACTIONS)[number]

export interface Reaction {
  id: number
  from: string
  /** Player the emoji flies over (whoever is on turn). */
  to: string
  emoji: ReactionEmoji
  at: number
}

export interface Session {
  code: string
  playerId: string
  token: string
}
