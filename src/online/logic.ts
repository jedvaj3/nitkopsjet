/**
 * Pure room rules for online games. Every function takes the stored state and
 * the current time and mutates the state in place; the host (`peer.ts`) keeps it.
 * Kept free of I/O so it can be unit-tested.
 */
import { markPlayed, pickFromCategories } from '@/game/engine'
import {
  checkDuplicate,
  duplicateMessage,
  fallbackVerdict,
  matchMeaning,
  verdictForIndex,
  type Judged,
  type Taken,
  type Verdict,
} from '@/game/meaning'
import {
  DEFAULT_FORMAT,
  OWN_DUPLICATE_MSG,
  REPLACE_SECONDS,
  ROUND_DUPLICATE_MSG,
  TRIO_SLOTS,
  ownDuplicateSlots,
  takenFrom,
  trioSeconds,
  trioSequence,
  type RoundFormat,
} from '@/game/trio'
import { CATEGORIES, questionById } from '@/game/questions'
import { rotateQuestion } from '@/game/rotate'
import type { CategoryId } from '@/game/types'
import { AVATAR_COUNT } from './avatars'
import {
  ROOM_MAX_PLAYERS,
  ROOM_ROUND_OPTIONS,
  ROOM_TIMER_OPTIONS,
  type PublicRoom,
  type PublicTurn,
  type RoomPlayer,
  type RoomSettings,
  type RoomState,
  type RoomRound,
  type RoomTurn,
  type TrioEntry,
  REACTIONS,
  type ReactionEmoji,
} from './types'

export const WRONG = 100
/** A player not seen for this long counts as offline. */
export const OFFLINE_MS = 16_000
/** An offline player whose turn it is gets skipped after this long. */
export const SKIP_OFFLINE_MS = 20_000
export const SUMMARY_MS = 30_000
/** Host-side slack after a displayed deadline (network + judging time). */
const TURN_GRACE_MS = 3_000
const LOCK_GRACE_MS = 10_000
const REPLACE_GRACE_MS = 9_000
const SEEN_WRITE_MS = 5_000

export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomCode(length = 4) {
  let s = ''
  for (let i = 0; i < length; i++)
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return s
}

export const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export function cleanName(name: string) {
  return name.replace(/\s+/g, ' ').trim().slice(0, 16)
}

export function cleanSettings(s: Partial<RoomSettings>): RoomSettings {
  const known = new Set(CATEGORIES.map((c) => c.id))
  const categories = [
    ...new Set(
      (s.categories ?? []).filter((c): c is CategoryId => known.has(c)),
    ),
  ]
  const rounds = (ROOM_ROUND_OPTIONS as readonly number[]).includes(
    Number(s.rounds),
  )
    ? Number(s.rounds)
    : 5
  const timer = (ROOM_TIMER_OPTIONS as readonly number[]).includes(
    Number(s.timer),
  )
    ? Number(s.timer)
    : 30
  const format: RoundFormat =
    s.format === 'classic' ? 'classic' : DEFAULT_FORMAT
  return { categories, rounds, timer, format }
}

function newPlayer(name: string, avatar: number, now: number): RoomPlayer {
  return {
    id: randomId(),
    token: randomId(),
    name: cleanName(name) || 'Igrač',
    avatar:
      Number.isInteger(avatar) && avatar >= 0 && avatar < AVATAR_COUNT
        ? avatar
        : 0,
    joinedAt: now,
    lastSeen: now,
  }
}

export function createRoom(
  code: string,
  host: { name: string; avatar: number },
  settings: Partial<RoomSettings>,
  now: number,
): { state: RoomState; player: RoomPlayer } {
  const player = newPlayer(host.name, host.avatar, now)
  return {
    player,
    state: {
      code,
      hostId: player.id,
      createdAt: now,
      seq: 0,
      game: 0,
      settings: cleanSettings(settings),
      players: [player],
      phase: 'lobby',
      rounds: [],
      roundIdx: 0,
      turnIdx: 0,
      deadline: null,
      phaseUntil: null,
    },
  }
}

export function joinRoom(
  state: RoomState,
  who: { name: string; avatar: number },
  now: number,
) {
  if (state.players.length >= ROOM_MAX_PLAYERS)
    throw new RoomError(
      `Soba je puna (najviše ${ROOM_MAX_PLAYERS} igrača).`,
      409,
    )
  const player = newPlayer(who.name, who.avatar, now)
  // Keep names unique so the desks are easy to tell apart.
  const taken = new Set(state.players.map((p) => p.name.toLowerCase()))
  let name = player.name
  for (let i = 2; taken.has(name.toLowerCase()); i++)
    name = `${player.name.slice(0, 13)} ${i}`
  player.name = name
  state.players.push(player)
  state.seq++
  return player
}

export function requirePlayer(
  state: RoomState,
  playerId: string,
  token: string,
) {
  const p = state.players.find((x) => x.id === playerId)
  if (!p || p.token !== token) throw new RoomError('Nisi u ovoj sobi.', 403)
  return p
}

const requireHost = (state: RoomState, playerId: string) => {
  if (state.hostId !== playerId)
    throw new RoomError('To može samo domaćin sobe.', 403)
}

export function updateSettings(
  state: RoomState,
  playerId: string,
  s: Partial<RoomSettings>,
) {
  requireHost(state, playerId)
  if (state.phase !== 'lobby' && state.phase !== 'final')
    throw new RoomError('Postavke se mogu mijenjati samo između igara.', 409)
  state.settings = cleanSettings({ ...state.settings, ...s })
  state.seq++
}

export function updateProfile(
  state: RoomState,
  playerId: string,
  who: { name?: string; avatar?: number },
) {
  const p = state.players.find((x) => x.id === playerId)!
  if (who.name !== undefined && cleanName(who.name))
    p.name = cleanName(who.name)
  if (
    who.avatar !== undefined &&
    Number.isInteger(who.avatar) &&
    who.avatar >= 0 &&
    who.avatar < AVATAR_COUNT
  )
    p.avatar = who.avatar
  state.seq++
}

/** Players in seat (join) order, rotated so a different player opens each round. */
/** The round's question with its anti-cheat rotation applied. */
export function roundQuestion(round: RoomRound) {
  const q = questionById(round.questionId)
  return q && rotateQuestion(q, round.variant ?? 0)
}

function orderForRound(state: RoomState, roundIdx: number) {
  const ids = state.players.map((p) => p.id)
  const shift = ids.length ? roundIdx % ids.length : 0
  return [...ids.slice(shift), ...ids.slice(0, shift)]
}

export function startGame(state: RoomState, playerId: string, now: number) {
  requireHost(state, playerId)
  if (state.phase !== 'lobby' && state.phase !== 'final')
    throw new RoomError('Igra je već u tijeku.', 409)
  const played = new Set(state.played ?? [])
  const questions = pickFromCategories(
    state.settings.categories,
    state.settings.rounds,
    played,
  )
  state.played = [...markPlayed(played, questions)]
  const counts = (state.playCounts ??= {})
  state.rounds = questions.map((q, i) => ({
    questionId: q.id,
    // Anti-cheat: a question played before in this room gets a rotated 0-point answer.
    variant: counts[q.id] ?? 0,
    order: i === 0 ? orderForRound(state, 0) : [],
    turns: [],
  }))
  for (const q of questions) counts[q.id] = (counts[q.id] ?? 0) + 1
  state.game++
  state.roundIdx = 0
  state.turnIdx = 0
  beginRound(state, now)
}

const isTrio = (state: RoomState) => state.settings.format !== 'classic'

function beginRound(state: RoomState, now: number) {
  if (!isTrio(state)) return beginTurn(state, now)
  const round = state.rounds[state.roundIdx]
  round.entries = {}
  round.revealIdx = 0
  round.replacing = undefined
  state.phase = 'input'
  state.deadline = now + trioSeconds(state.settings.timer) * 1000
  state.phaseUntil = null
  state.seq++
}

function beginTurn(state: RoomState, now: number) {
  state.phase = 'turn'
  state.deadline = now + state.settings.timer * 1000
  state.phaseUntil = null
  state.seq++
}

/** The trio reveal item at the current position, if any. */
function trioItem(state: RoomState) {
  const round = state.rounds[state.roundIdx]
  if (!round) return null
  return trioSequence(round.order)[round.revealIdx ?? 0] ?? null
}

export function currentPlayerId(state: RoomState): string | null {
  if (state.phase === 'replace')
    return state.rounds[state.roundIdx]?.replacing?.playerId ?? null
  if (state.phase === 'reveal' && isTrio(state))
    return trioItem(state)?.player ?? null
  if (state.phase !== 'turn' && state.phase !== 'reveal') return null
  return state.rounds[state.roundIdx]?.order[state.turnIdx] ?? null
}

function revealMs(points: number, wrong: boolean) {
  if (wrong) return 3_000
  return 450 + (100 - points) * 34 + 350 + 2_300
}

function recordTurn(
  state: RoomState,
  turn: Omit<RoomTurn, 'seq'>,
  now: number,
) {
  state.seq++
  state.rounds[state.roundIdx].turns.push({ ...turn, seq: state.seq })
  state.phase = 'reveal'
  state.deadline = null
  state.phaseUntil =
    now + revealMs(turn.points, turn.answerIndex === null && !turn.novel)
}

/** What the current player needs judged: the question and answers already used. */
export function pendingJudgement(state: RoomState, playerId: string) {
  if (state.phase !== 'turn' || currentPlayerId(state) !== playerId)
    throw new RoomError('Nisi na redu.', 409)
  const round = state.rounds[state.roundIdx]
  const question = roundQuestion(round)
  if (!question) throw new RoomError('Pitanje nije pronađeno.', 500)
  const taken: Taken = {
    indexes: round.turns
      .map((t) => t.answerIndex)
      .filter((i): i is number => i !== null),
    novels: round.turns.map((t) => t.novel).filter((n): n is string => !!n),
  }
  return { question, taken }
}

/**
 * Record the current player's answer. `judged` comes from the (async) AI
 * judge on the server; without it the answer is judged locally.
 */
export function submitAnswer(
  state: RoomState,
  playerId: string,
  input: string,
  now: number,
  judged?: Judged,
) {
  const value = input.trim().slice(0, 80)
  if (!value) throw new RoomError('Upiši odgovor.')
  const { question, taken } = pendingJudgement(state, playerId)
  const local = (): Judged => {
    const idx = matchMeaning(question, value)
    return checkDuplicate(
      question,
      idx !== null
        ? verdictForIndex(question, idx, 'baza')
        : fallbackVerdict(question, value),
      taken,
    )
  }
  // Re-check duplicates against the latest state (another write may have landed).
  const result = judged?.ok
    ? checkDuplicate(question, judged.verdict, taken)
    : (judged ?? local())
  if (!result.ok) throw new RoomError(duplicateMessage(result.duplicate), 409)
  const v = result.verdict
  const started = (state.deadline ?? now) - state.settings.timer * 1000
  recordTurn(
    state,
    {
      playerId,
      input: value,
      answerIndex: v.answerIndex,
      points: v.points,
      timedOut: false,
      novel: v.novel,
      judge: v.source,
      reason: v.reason,
      ms: Math.max(0, now - started),
    },
    now,
  )
}

// ───────────── Trio (Finale) format ─────────────

const emptyEntries = (): TrioEntry[] =>
  Array.from({ length: TRIO_SLOTS }, () => ({
    input: '',
    answerIndex: null,
    points: WRONG,
  }))

/** Players seated for the current round (late joiners play from the next round). */
function seated(state: RoomState) {
  const order = new Set(state.rounds[state.roundIdx]?.order ?? [])
  return state.players.filter((p) => order.has(p.id))
}

function allLocked(state: RoomState) {
  const entries = state.rounds[state.roundIdx]?.entries ?? {}
  const players = seated(state)
  return players.length > 0 && players.every((p) => entries[p.id])
}

const toVerdict = (e: TrioEntry): Verdict => ({
  answerIndex: e.answerIndex,
  points: e.points,
  novel: e.novel,
  source: e.judge ?? 'baza',
  reason: e.reason,
})

const turnVerdict = (t: RoomTurn): Verdict => ({
  answerIndex: t.answerIndex,
  points: t.points,
  novel: t.novel,
  source: t.judge ?? 'baza',
})

/** Answers already revealed this round (others' and own). */
function revealedTaken(state: RoomState) {
  return takenFrom(
    state.rounds[state.roundIdx].turns
      .filter((t) => !t.timedOut)
      .map(turnVerdict),
  )
}

/** The question while the player may lock answers. */
export function pendingLock(state: RoomState, playerId: string) {
  if (state.phase !== 'input')
    throw new RoomError('Sada se ne upisuju odgovori.', 409)
  const round = state.rounds[state.roundIdx]
  if (!round.order.includes(playerId))
    throw new RoomError('Ulaziš u igru od iduće runde.', 409)
  if (round.entries?.[playerId])
    throw new RoomError('Već si zaključao/la odgovore.', 409)
  const question = roundQuestion(round)
  if (!question) throw new RoomError('Pitanje nije pronađeno.', 500)
  return { question }
}

/** Store a player's 3 judged answers (`verdicts[i]` is null for an empty field). */
export function lockAnswers(
  state: RoomState,
  playerId: string,
  inputs: string[],
  verdicts: (Verdict | null)[],
  now: number,
) {
  pendingLock(state, playerId)
  const clean = Array.from({ length: TRIO_SLOTS }, (_, i) =>
    (inputs[i] ?? '').trim().slice(0, 80),
  )
  const dups = ownDuplicateSlots(clean, verdicts)
  if (dups.length)
    throw new RoomError(`${OWN_DUPLICATE_MSG} (polje ${dups[0] + 1})`, 409)
  const ms = Math.max(
    0,
    now - ((state.deadline ?? now) - trioSeconds(state.settings.timer) * 1000),
  )
  state.rounds[state.roundIdx].entries![playerId] = clean.map((input, i) => {
    const v = input ? verdicts[i] : null
    return v
      ? {
          input,
          answerIndex: v.answerIndex,
          points: v.points,
          novel: v.novel,
          judge: v.source,
          reason: v.reason,
          ms,
        }
      : { input, answerIndex: null, points: WRONG, ms }
  })
  state.seq++
  if (allLocked(state)) startReveal(state, now)
}

function startReveal(state: RoomState, now: number) {
  const round = state.rounds[state.roundIdx]
  round.order = [...round.order].sort(
    (a, b) =>
      (round.entries?.[a]?.[0]?.ms ?? Infinity) -
      (round.entries?.[b]?.[0]?.ms ?? Infinity),
  )
  round.revealIdx = 0
  revealStep(state, now)
}


/** Reveal the next answer in the sequence, or ask for a replacement if it's a duplicate. */
function revealStep(state: RoomState, now: number) {
  const round = state.rounds[state.roundIdx]
  const seq = trioSequence(round.order)
  const present = new Set(state.players.map((p) => p.id))
  let i = round.revealIdx ?? 0
  while (i < seq.length && !present.has(seq[i].player)) i++
  round.revealIdx = i
  const item = seq[i]
  if (!item) {
    state.phase = 'summary'
    state.deadline = null
    state.phaseUntil = now + SUMMARY_MS
    state.seq++
    return
  }
  const entry = round.entries?.[item.player]?.[item.slot] ?? emptyEntries()[0]
  if (entry.input && (entry.answerIndex !== null || entry.novel)) {
    const dup = checkDuplicate(
      roundQuestion(round)!,
      toVerdict(entry),
      revealedTaken(state),
    )
    if (!dup.ok) {
      round.replacing = {
        playerId: item.player,
        slot: item.slot,
        input: entry.input,
        duplicate: dup.duplicate,
      }
      state.phase = 'replace'
      state.deadline = now + REPLACE_SECONDS * 1000
      state.phaseUntil = null
      state.seq++
      return
    }
  }
  recordTurn(
    state,
    {
      playerId: item.player,
      input: entry.input,
      answerIndex: entry.answerIndex,
      points: entry.points,
      timedOut: false,
      novel: entry.novel,
      judge: entry.judge,
      reason: entry.reason,
      slot: item.slot,
      ms: entry.ms,
    },
    now,
  )
}

/** Question and answers to avoid while replacing a duplicate. */
export function pendingReplace(state: RoomState, playerId: string) {
  const round = state.rounds[state.roundIdx]
  if (state.phase !== 'replace' || round.replacing?.playerId !== playerId)
    throw new RoomError('Ne trebaš mijenjati odgovor.', 409)
  const question = roundQuestion(round)!
  const r = round.replacing
  // Avoid everything revealed so far and the player's own other answers.
  const own = (round.entries?.[playerId] ?? [])
    .filter(
      (e, i) => i !== r.slot && e.input && (e.answerIndex !== null || e.novel),
    )
    .map(toVerdict)
  const revealed = round.turns.filter((t) => !t.timedOut).map(turnVerdict)
  return { question, taken: takenFrom([...revealed, ...own]) }
}

/** Replace a duplicate answer with a new one. */
export function replaceAnswer(
  state: RoomState,
  playerId: string,
  input: string,
  now: number,
  judged?: Judged,
) {
  const value = input.trim().slice(0, 80)
  if (!value) throw new RoomError('Upiši zamjenski odgovor.')
  const { question, taken } = pendingReplace(state, playerId)
  const local = (): Judged => {
    const idx = matchMeaning(question, value)
    return checkDuplicate(
      question,
      idx !== null
        ? verdictForIndex(question, idx, 'baza')
        : fallbackVerdict(question, value),
      taken,
    )
  }
  const result = judged?.ok
    ? checkDuplicate(question, judged.verdict, taken)
    : (judged ?? local())
  if (!result.ok) throw new RoomError(ROUND_DUPLICATE_MSG, 409)
  const round = state.rounds[state.roundIdx]
  const r = round.replacing!
  const v = result.verdict
  round.entries![playerId][r.slot] = {
    input: value,
    answerIndex: v.answerIndex,
    points: v.points,
    novel: v.novel,
    judge: v.source,
    reason: v.reason,
  }
  round.replacing = undefined
  recordTurn(
    state,
    {
      playerId,
      input: value,
      answerIndex: v.answerIndex,
      points: v.points,
      timedOut: false,
      novel: v.novel,
      judge: v.source,
      reason: v.reason,
      slot: r.slot,
    },
    now,
  )
}

function advanceTurn(state: RoomState, now: number) {
  const round = state.rounds[state.roundIdx]
  const present = new Set(state.players.map((p) => p.id))
  let i = state.turnIdx + 1
  while (i < round.order.length && !present.has(round.order[i])) i++
  if (i < round.order.length) {
    state.turnIdx = i
    beginTurn(state, now)
    return
  }
  state.phase = 'summary'
  state.deadline = null
  state.phaseUntil = now + SUMMARY_MS
  state.seq++
}

function advanceRound(state: RoomState, now: number) {
  if (state.roundIdx + 1 >= state.rounds.length || state.players.length === 0) {
    state.phase = 'final'
    state.deadline = null
    state.phaseUntil = null
    state.seq++
    return
  }
  state.roundIdx++
  state.turnIdx = 0
  state.rounds[state.roundIdx].order = orderForRound(state, state.roundIdx)
  beginRound(state, now)
}

export function nextRound(state: RoomState, playerId: string, now: number) {
  requireHost(state, playerId)
  if (state.phase !== 'summary') throw new RoomError('Runda još traje.', 409)
  advanceRound(state, now)
}

export function leaveRoom(state: RoomState, playerId: string, now: number) {
  state.players = state.players.filter((p) => p.id !== playerId)
  if (state.hostId === playerId && state.players[0])
    state.hostId = state.players[0].id
  state.seq++
  if (state.phase === 'turn' && currentPlayerId(state) === playerId) {
    // The leaver is skipped without a score.
    advanceTurn(state, now)
  } else if (state.phase === 'input' && allLocked(state)) {
    startReveal(state, now)
  } else if (state.phase === 'replace' && currentPlayerId(state) === playerId) {
    const round = state.rounds[state.roundIdx]
    round.replacing = undefined
    round.revealIdx! += 1
    revealStep(state, now)
  }
}

/** How long a reaction stays in the room view. */
const REACTION_TTL_MS = 10_000
/** At most this many reactions per player are taken from one poll. */
const REACTIONS_PER_SYNC = 4
const REACTION_GAP_MS = 600

/** Phases where someone is on turn and the others can heckle. */
export const canReact = (state: RoomState) =>
  state.phase === 'turn' ||
  state.phase === 'reveal' ||
  state.phase === 'replace'

/** A player throws an emoji at whoever is currently on turn. */
export function react(
  state: RoomState,
  playerId: string,
  emoji: string,
  now: number,
) {
  if (!(REACTIONS as readonly string[]).includes(emoji))
    throw new RoomError('Nepoznata reakcija.')
  const to = currentPlayerId(state)
  if (!canReact(state) || !to)
    throw new RoomError('Trenutno nitko nije na redu.', 409)
  if (to === playerId)
    throw new RoomError('Ne možeš reagirati sam/a na sebe.', 409)
  const recent = (state.reactions ?? []).filter(
    (r) => now - r.at < REACTION_TTL_MS,
  )
  const mine = recent.filter((r) => r.from === playerId).at(-1)
  if (mine && now - mine.at < REACTION_GAP_MS)
    throw new RoomError('Polako! 🙂', 429)
  state.reactionSeq = (state.reactionSeq ?? 0) + 1
  state.reactions = [
    ...recent.slice(-19),
    {
      id: state.reactionSeq,
      from: playerId,
      to,
      emoji: emoji as ReactionEmoji,
      at: now,
    },
  ]
}

/**
 * Apply reactions a player queued since their last poll. They are spread out
 * slightly in time (newest = now) so the per-player rate limit still holds.
 * Invalid ones (turn just ended, rate-limited) are dropped silently.
 */
export function reactBatch(
  state: RoomState,
  playerId: string,
  emojis: string[],
  now: number,
): boolean {
  const list = emojis.slice(-REACTIONS_PER_SYNC)
  let added = false
  list.forEach((emoji, i) => {
    try {
      react(
        state,
        playerId,
        emoji,
        now - (list.length - 1 - i) * REACTION_GAP_MS,
      )
      added = true
    } catch {
      /* ignore */
    }
  })
  return added
}

/** Mark a player as seen. Returns true when the state changed enough to store. */
export function touch(state: RoomState, playerId: string, now: number) {
  const p = state.players.find((x) => x.id === playerId)
  if (!p || now - p.lastSeen < SEEN_WRITE_MS) return false
  p.lastSeen = now
  return true
}

/**
 * Time-based progress: timeouts, skipping absent players, leaving the reveal
 * and summary screens, host hand-over. Returns true when something changed.
 */
export function tick(state: RoomState, now: number): boolean {
  const before = state.seq
  // Hand the host role over if the host has disappeared.
  const host = state.players.find((p) => p.id === state.hostId)
  if (!host || now - host.lastSeen > SKIP_OFFLINE_MS) {
    const next = state.players.find((p) => now - p.lastSeen <= OFFLINE_MS)
    if (next && next.id !== state.hostId) {
      state.hostId = next.id
      state.seq++
    }
  }
  for (let guard = 0; guard < 20; guard++) {
    if (state.phase === 'turn') {
      const pid = currentPlayerId(state)
      const p = state.players.find((x) => x.id === pid)
      if (!p) {
        advanceTurn(state, now)
        continue
      }
      const absent = now - p.lastSeen > SKIP_OFFLINE_MS
      if (
        (state.deadline !== null && now >= state.deadline + TURN_GRACE_MS) ||
        absent
      ) {
        recordTurn(
          state,
          {
            playerId: p.id,
            input: '',
            answerIndex: null,
            points: WRONG,
            timedOut: true,
            ms: state.settings.timer * 1000,
          },
          now,
        )
        continue
      }
    } else if (
      state.phase === 'reveal' &&
      state.phaseUntil !== null &&
      now >= state.phaseUntil
    ) {
      if (isTrio(state)) {
        state.rounds[state.roundIdx].revealIdx! += 1
        revealStep(state, now)
      } else advanceTurn(state, now)
      continue
    } else if (state.phase === 'input') {
      const round = state.rounds[state.roundIdx]
      const expired =
        state.deadline !== null && now >= state.deadline + LOCK_GRACE_MS
      if (expired) {
        // Players who didn't lock in time get empty answers (100 each).
        for (const p of seated(state))
          if (!round.entries?.[p.id]) round.entries![p.id] = emptyEntries()
      }
      if (allLocked(state)) {
        startReveal(state, now)
        continue
      }
    } else if (
      state.phase === 'replace' &&
      state.deadline !== null &&
      now >= state.deadline + REPLACE_GRACE_MS
    ) {
      const r = state.rounds[state.roundIdx].replacing!
      recordTurn(
        state,
        {
          playerId: r.playerId,
          input: '',
          answerIndex: null,
          points: WRONG,
          timedOut: true,
          slot: r.slot,
        },
        now,
      )
      state.rounds[state.roundIdx].replacing = undefined
      continue
    } else if (
      state.phase === 'summary' &&
      state.phaseUntil !== null &&
      now >= state.phaseUntil
    ) {
      advanceRound(state, now)
      continue
    }
    break
  }
  return state.seq !== before
}

function publicTurn(t: RoomTurn, round: RoomRound): PublicTurn {
  const q = roundQuestion(round)
  return {
    playerId: t.playerId,
    input: t.input,
    answerText:
      t.answerIndex !== null && q
        ? q.answers[t.answerIndex].text
        : (t.novel ?? null),
    novel: !!t.novel,
    judge: t.judge,
    reason: t.reason,
    points: t.points,
    timedOut: t.timedOut,
    seq: t.seq,
    slot: t.slot,
    ms: t.ms,
  }
}

/** The client-safe view: no tokens, and answer lists only for finished rounds. */
export function toPublic(state: RoomState, now: number): PublicRoom {
  const totals = new Map<string, number>()
  for (const r of state.rounds)
    for (const t of r.turns)
      totals.set(t.playerId, (totals.get(t.playerId) ?? 0) + t.points)

  const started = state.phase !== 'lobby'
  const visibleRounds = started ? state.rounds.slice(0, state.roundIdx + 1) : []
  const rounds = visibleRounds.map((r, i) => {
    const q = roundQuestion(r)!
    const finished =
      i < state.roundIdx || state.phase === 'summary' || state.phase === 'final'
    return {
      question: { id: q.id, text: q.text, hint: q.hint, category: q.category },
      order: r.order,
      turns: r.turns.map((t) => publicTurn(t, r)),
      answers: finished
        ? [...q.answers]
            .sort((a, b) => a.points - b.points)
            .map((a) => ({ text: a.text, points: a.points }))
        : undefined,
    }
  })
  const current = rounds[state.roundIdx]
  return {
    code: state.code,
    hostId: state.hostId,
    seq: state.seq,
    game: state.game,
    settings: state.settings,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      online: now - p.lastSeen <= OFFLINE_MS,
      total: totals.get(p.id) ?? 0,
    })),
    phase: state.phase,
    roundIdx: state.roundIdx,
    totalRounds: state.rounds.length || state.settings.rounds,
    turnIdx: state.turnIdx,
    currentPlayerId: currentPlayerId(state),
    deadline: state.deadline,
    phaseUntil: state.phaseUntil,
    now,
    rounds,
    lastTurn:
      current && current.turns.length
        ? current.turns[current.turns.length - 1]
        : null,
    reactions: (state.reactions ?? []).filter(
      (r) => now - r.at < REACTION_TTL_MS,
    ),
    locked: Object.keys(state.rounds[state.roundIdx]?.entries ?? {}),
    replacing:
      (state.phase === 'replace' && state.rounds[state.roundIdx]?.replacing) ||
      null,
    revealSlot:
      isTrio(state) && (state.phase === 'reveal' || state.phase === 'replace')
        ? (trioItem(state)?.slot ?? null)
        : null,
  }
}
