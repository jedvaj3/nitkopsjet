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
  | 'slike'
  | 'odrasli'
  | 'from'
  | 'tlou'
  | 'twd'
  | 'stranger'
  | 'breakingbad'
  | 'got'
  | 'peaky'
  | 'squidgame'
  | 'lacasa'
  | 'dina'
  | 'oppenheimer'
  | 'harrypotter'
  | 'marvel'
  | 'dc'
  | 'mentalist'
  | 'dahmer'
  | 'dexter'
  | 'lost'
  | 'sumrak'
  | 'najboljegodine'
  | 'lzn'
  | 'zauvijeksusjedi'

export type CategoryChoice = CategoryId | CategoryId[] | 'mix'

export interface Answer {
  text: string
  points: number
  alts: string[]
}

export interface Question {
  id: string
  category: CategoryId
  text: string
  image?: string
  hint?: string
  surnames?: boolean
  answers: Answer[]
  variant?: number
}

export type GameMode = 'solo' | 'duel' | 'teams' | 'ffa'
export type TimerSetting = 0 | 30 | 15

export interface GameConfig {
  mode: GameMode
  category: CategoryChoice
  timer: TimerSetting
  players: string[]
  teams?: [string, string]
  format?: RoundFormat
}

export interface Turn {
  player: number
  input: string
  answerIndex: number | null
  points: number
  timedOut: boolean
  novel?: string
  judge?: 'baza' | 'ai' | 'rezerva'
  reason?: string
  slot?: number
  ms?: number
}

export interface Round {
  question: Question
  turns: Turn[]
  loser?: number | null
}
