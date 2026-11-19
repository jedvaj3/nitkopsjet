import type { RoundFormat } from './trio'
export type CategoryId =
  | 'sport'
  | 'geografija'
  | 'film'
  | 'glazba'
  | 'povijest'
  | 'znanost'
  | 'hrvatska'
  | 'opca'
  | 'odrasli'

export type CategoryChoice = CategoryId | 'mix'

export interface Answer {
  /** Display name of the correct answer. */
  text: string
  /** How many of 100 respondents named this answer (0–100). */
  points: number
  /** Accepted alternative spellings / names. */
  alts: string[]
}

export interface Question {
  id: string
  category: CategoryId
  text: string
  /** Short clarification shown under the question. */
  hint?: string
  /** If true, a unique surname alone is also accepted for person answers. */
  surnames?: boolean
  answers: Answer[]
  /** Anti-cheat rotation applied to this copy (how many times it was played before). */
  variant?: number
}

/**
 * solo: one player. duel: 2 players with lives. teams: 2 vs 2 with team lives.
 * ffa: 3–5 players, everyone for themselves, lowest total wins.
 */
export type GameMode = 'solo' | 'duel' | 'teams' | 'ffa'

/** Seconds per answer; 0 means relaxed (no timer). */
export type TimerSetting = 0 | 30 | 15

export interface GameConfig {
  mode: GameMode
  category: CategoryChoice
  timer: TimerSetting
  /**
   * Player names in seat order. For `teams` the order is interleaved:
   * [team A player 1, team B player 1, team A player 2, team B player 2].
   */
  players: string[]
  /** Team names (teams mode only). */
  teams?: [string, string]
  /** Multiplayer: 3 answers per player revealed in rounds (default) or classic. */
  format?: RoundFormat
}

export interface Turn {
  player: number
  input: string
  /** Index into question.answers, or null if wrong / timed out. */
  answerIndex: number | null
  points: number
  timedOut: boolean
  /** A valid answer the AI judge accepted although it isn't in the list. */
  novel?: string
  /** Who judged the answer: the answer list, the AI judge or the offline fallback. */
  judge?: 'baza' | 'ai' | 'rezerva'
  /** Short explanation from the judge. */
  reason?: string
  /** Finale format: which of the player's 3 answers (0–2). */
  slot?: number
  /** How long the player took to answer (for the end-of-game titles). */
  ms?: number
}

export interface Round {
  question: Question
  turns: Turn[]
  /** Duel/teams: index of the side (player or team) that lost a life this round (null = tie). */
  loser?: number | null
}
