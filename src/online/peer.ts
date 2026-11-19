/**
 * Online rooms without a server: the phone that creates a room becomes a
 * PeerJS (WebRTC) host. It keeps the room state in memory, runs the same
 * rules as before (`logic.ts`) and pushes every change to the other phones
 * over direct data channels. Nothing goes through Netlify, so a room costs no
 * function calls, requests or database time.
 *
 * Only the free public PeerJS broker is used to introduce the phones to each
 * other; after that the traffic is phone-to-phone (Google STUN finds the
 * public address, the PeerJS TURN relay is a fallback for strict mobile NATs).
 */
import type { DataConnection, Peer as PeerType, PeerOptions } from 'peerjs'
import { z } from 'zod'
import { judgeLocally } from '@/game/judgeClient'
import {
  RoomError,
  createRoom,
  joinRoom,
  leaveRoom,
  lockAnswers,
  nextRound,
  pendingJudgement,
  pendingLock,
  pendingReplace,
  randomCode,
  react,
  replaceAnswer,
  requirePlayer,
  startGame,
  submitAnswer,
  tick,
  toPublic,
  touch,
  updateProfile,
  updateSettings,
} from './logic'
import {
  ROOM_CODE_LENGTH,
  type PublicRoom,
  type RoomSettings,
  type RoomState,
  type Session,
} from './types'
import { holdWakeLock } from './wakeLock'

export const PEER_PREFIX = 'nitkosjet-'
/** Guests tell the host they are still here this often. */
const PING_MS = 4000
/** The host re-sends the room this often so clocks and "online" dots stay fresh. */
const HEARTBEAT_MS = 3000
const TICK_MS = 500
const REQUEST_TIMEOUT_MS = 12_000
const CONNECT_TIMEOUT_MS = 15_000
const RECONNECT_MS = 3000
const HOST_STATE_KEY = 'nitkosjet:host-room:v1:'
const HOST_STATE_TTL_MS = 24 * 60 * 60 * 1000

const PEER_OPTIONS: PeerOptions = {
  debug: 0,
  config: {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
        ],
      },
      // Free public relay that ships with PeerJS: used only when two phones
      // cannot reach each other directly (some 4G/5G carrier NATs).
      {
        urls: [
          'turn:eu-0.turn.peerjs.com:3478',
          'turn:us-0.turn.peerjs.com:3478',
        ],
        username: 'peerjs',
        credential: 'peerjsp',
      },
    ],
  },
}

export class LinkError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message)
  }
}

export type LinkEvent =
  | { type: 'room'; room: PublicRoom }
  | { type: 'error'; message: string }
  | { type: 'fatal'; message: string }

export interface ActionResult {
  room: PublicRoom
  session?: Session
}

/** What the room screen talks to — the same for the host and for guests. */
export interface RoomLink {
  request(
    action: string,
    extra?: Record<string, unknown>,
  ): Promise<ActionResult>
  /** Fire-and-forget (reactions). */
  send(action: string, extra?: Record<string, unknown>): void
  subscribe(fn: (e: LinkEvent) => void): () => void
  close(): void
}

type Auth = { playerId: string; token: string }

type ToHost =
  | {
      t: 'req'
      id: number
      action: string
      auth?: Auth
      data?: Record<string, unknown>
    }
  | { t: 'ping'; auth: Auth }

type FromHost =
  | {
      t: 'res'
      id: number
      ok: true
      room: PublicRoom
      session?: Session
    }
  | { t: 'res'; id: number; ok: false; error: string; status: number }
  | { t: 'room'; room: PublicRoom }
  | { t: 'closed'; reason: string }

const loadPeer = async () => (await import('peerjs')).Peer

const peerId = (code: string) => PEER_PREFIX + code.toUpperCase()

// ───────────────────────── Validation of guest messages ─────────────────────────

const profile = {
  name: z.string().max(40),
  avatar: z.number().int().min(0).max(99),
}
const settings = z
  .object({
    categories: z.array(z.string().max(20)).max(20).optional(),
    rounds: z.number().int().optional(),
    timer: z.number().int().optional(),
    format: z.enum(['trio', 'classic']).optional(),
  })
  .partial()
const input = z.string().max(120)

const Data = {
  join: z.object(profile),
  answer: z.object({ input }),
  replace: z.object({ input }),
  lock: z.object({ inputs: z.array(input).max(3) }),
  settings: z.object({ settings }),
  profile: z.object({
    name: profile.name.optional(),
    avatar: profile.avatar.optional(),
  }),
  react: z.object({ emoji: z.string().max(16) }),
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data ?? {})
  if (!r.success) throw new RoomError('Neispravan zahtjev.')
  return r.data
}

// ───────────────────────────────── Host ─────────────────────────────────

/**
 * The room "server", running in the host's browser. Actions from guests (and
 * from the host's own screen) are applied one at a time, then the new public
 * view is pushed to everyone.
 */
class HostRoom implements RoomLink {
  private conns = new Map<DataConnection, string | null>()
  private listeners = new Set<(e: LinkEvent) => void>()
  private queue: Promise<unknown> = Promise.resolve()
  private timers: ReturnType<typeof setInterval>[] = []
  private releaseWake: (() => void) | null = null
  private closed = false

  private constructor(
    private peer: PeerType,
    private state: RoomState,
    private auth: Auth,
  ) {
    peer.on('connection', (c) => this.accept(c))
    peer.on('disconnected', () => {
      // Lost the broker only: open data channels keep working. Re-register so
      // new / reconnecting phones can find the room again.
      setTimeout(() => {
        if (!this.closed && peer.disconnected && !peer.destroyed)
          peer.reconnect()
      }, RECONNECT_MS)
    })
    peer.on('error', (e) => {
      if (e.type === 'network' || e.type === 'server-error')
        this.emit({
          type: 'error',
          message: 'Veza s posrednikom je prekinuta.',
        })
    })
    let beat = 0
    this.timers.push(
      setInterval(() => {
        const now = Date.now()
        const me = this.state.players.find((p) => p.id === this.auth.playerId)
        if (me) me.lastSeen = now
        const changed = tick(this.state, now)
        beat += TICK_MS
        if (changed || beat >= HEARTBEAT_MS) {
          beat = 0
          this.publish(changed)
        }
      }, TICK_MS),
    )
    this.releaseWake = holdWakeLock()
    this.publish(true)
  }

  get code() {
    return this.state.code
  }

  /** Register a free 4-character room code with the broker. */
  static async create(
    host: { name: string; avatar: number },
    s: RoomSettings,
  ): Promise<{ room: HostRoom; session: Session }> {
    const Peer = await loadPeer()
    pruneHostStates()
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = randomCode(ROOM_CODE_LENGTH)
      const peer = await openPeer(Peer, peerId(code)).catch((e: unknown) => {
        if (e instanceof LinkError && e.status === 409) return null
        throw e
      })
      if (!peer) continue
      const now = Date.now()
      const { state, player } = createRoom(code, host, s, now)
      const auth = { playerId: player.id, token: player.token }
      return {
        room: new HostRoom(peer, state, auth),
        session: { code, ...auth, host: true },
      }
    }
    throw new LinkError('Nije moguće kreirati sobu, pokušaj ponovno.', 503)
  }

  /** After a refresh: take the saved state and the same code back. */
  static async restore(session: Session): Promise<HostRoom> {
    const state = loadHostState(session.code)
    if (!state)
      throw new LinkError('Soba više ne postoji na ovom uređaju.', 404)
    const Peer = await loadPeer()
    // The broker can keep the old registration for a few seconds.
    for (let attempt = 0; ; attempt++) {
      try {
        const peer = await openPeer(Peer, peerId(session.code))
        return new HostRoom(peer, state, session)
      } catch (e) {
        if (!(e instanceof LinkError) || e.status !== 409 || attempt >= 10)
          throw e
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  private accept(conn: DataConnection) {
    this.conns.set(conn, null)
    conn.on('data', (raw) => this.receive(conn, raw as ToHost))
    conn.on('close', () => this.conns.delete(conn))
    conn.on('error', () => this.conns.delete(conn))
  }

  private receive(conn: DataConnection, msg: ToHost) {
    if (!msg || typeof msg !== 'object') return
    if (msg.t === 'ping') {
      const p = this.state.players.find(
        (x) => x.id === msg.auth?.playerId && x.token === msg.auth?.token,
      )
      if (!p) return
      this.conns.set(conn, p.id)
      if (touch(this.state, p.id, Date.now())) this.publish(false)
      return
    }
    if (msg.t !== 'req' || typeof msg.id !== 'number') return
    this.run(msg.action, msg.auth, msg.data).then(
      (res) => {
        if (res.session) this.conns.set(conn, res.session.playerId)
        else if (msg.auth) this.conns.set(conn, msg.auth.playerId)
        safeSend(conn, { t: 'res', id: msg.id, ok: true, ...res })
      },
      (e: unknown) =>
        safeSend(conn, {
          t: 'res',
          id: msg.id,
          ok: false,
          error: errorMessage(e),
          status: e instanceof RoomError ? e.status : 500,
        }),
    )
  }

  /** Apply actions strictly one after another. */
  private run(
    action: string,
    auth: Auth | undefined,
    data: Record<string, unknown> | undefined,
  ): Promise<ActionResult> {
    const job = this.queue.then(() => this.apply(action, auth, data))
    this.queue = job.catch(() => undefined)
    return job
  }

  private async apply(
    action: string,
    auth: Auth | undefined,
    data: Record<string, unknown> | undefined,
  ): Promise<ActionResult> {
    if (this.closed) throw new RoomError('Soba je zatvorena.', 404)
    const s = this.state
    const now = Date.now()

    if (action === 'peek') {
      tick(s, now)
      return { room: toPublic(s, now) }
    }

    if (action === 'join') {
      const who = parse(Data.join, data)
      tick(s, now)
      const p = joinRoom(s, who, now)
      this.publish(true)
      return {
        room: toPublic(s, now),
        session: { code: s.code, playerId: p.id, token: p.token },
      }
    }

    if (!auth) throw new RoomError('Nisi u ovoj sobi.', 403)
    requirePlayer(s, auth.playerId, auth.token)
    const pid = auth.playerId
    touch(s, pid, now)
    tick(s, now)

    switch (action) {
      case 'sync':
        break
      case 'start':
        startGame(s, pid, now)
        break
      case 'answer': {
        const { input } = parse(Data.answer, data)
        const { question, taken } = pendingJudgement(s, pid)
        const judged = await judgeLocally(question, input, taken)
        submitAnswer(s, pid, input, Date.now(), judged)
        break
      }
      case 'lock': {
        // Cross-player duplicates are only resolved during the reveal.
        const { inputs } = parse(Data.lock, data)
        const { question } = pendingLock(s, pid)
        const none = { indexes: [], novels: [] }
        const verdicts = await Promise.all(
          inputs.map(async (text) => {
            if (!text.trim()) return null
            const j = await judgeLocally(question, text, none)
            return j.ok ? j.verdict : null
          }),
        )
        lockAnswers(s, pid, inputs, verdicts, Date.now())
        break
      }
      case 'replace': {
        const { input } = parse(Data.replace, data)
        const { question, taken } = pendingReplace(s, pid)
        const judged = await judgeLocally(question, input, taken)
        replaceAnswer(s, pid, input, Date.now(), judged)
        break
      }
      case 'react': {
        const { emoji } = parse(Data.react, data)
        react(s, pid, emoji, now)
        break
      }
      case 'next':
        nextRound(s, pid, now)
        break
      case 'leave':
        if (pid === s.hostId) {
          this.shutdown('Domaćin je zatvorio sobu.')
          return { room: toPublic(s, now) }
        }
        leaveRoom(s, pid, now)
        break
      case 'settings':
        updateSettings(s, pid, parse(Data.settings, data).settings as never)
        break
      case 'profile':
        updateProfile(s, pid, parse(Data.profile, data))
        break
      default:
        throw new RoomError('Nepoznata radnja.')
    }
    this.publish(true)
    return { room: toPublic(s, Date.now()) }
  }

  /** Push the current public view to every phone (and the host's own screen). */
  private publish(save: boolean) {
    if (this.closed) return
    const room = toPublic(this.state, Date.now())
    if (save) saveHostState(this.state)
    // Only phones that joined (or rejoined) get live updates.
    for (const [conn, pid] of this.conns)
      if (pid) safeSend(conn, { t: 'room', room })
    this.emit({ type: 'room', room })
  }

  private emit(e: LinkEvent) {
    for (const fn of this.listeners) fn(e)
  }

  private shutdown(reason: string) {
    for (const conn of this.conns.keys())
      safeSend(conn, { t: 'closed', reason })
    clearHostState(this.state.code)
    // Give the goodbye message a moment to leave before tearing down.
    setTimeout(() => this.close(), 400)
  }

  // ── RoomLink (the host's own screen) ──

  request(action: string, extra: Record<string, unknown> = {}) {
    return this.run(action, this.auth, extra).catch((e: unknown) => {
      throw new LinkError(
        errorMessage(e),
        e instanceof RoomError ? e.status : 0,
      )
    })
  }

  send(action: string, extra: Record<string, unknown> = {}) {
    this.request(action, extra).catch(() => undefined)
  }

  subscribe(fn: (e: LinkEvent) => void) {
    this.listeners.add(fn)
    fn({ type: 'room', room: toPublic(this.state, Date.now()) })
    return () => {
      this.listeners.delete(fn)
    }
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.timers.forEach(clearInterval)
    this.releaseWake?.()
    this.peer.destroy()
    hosts.delete(this.state.code)
  }
}

// ───────────────────────────────── Guest ─────────────────────────────────

class GuestLink implements RoomLink {
  private peer: PeerType | null = null
  private conn: DataConnection | null = null
  private connecting: Promise<void> | null = null
  private pending = new Map<
    number,
    {
      resolve: (r: ActionResult) => void
      reject: (e: LinkError) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  private listeners = new Set<(e: LinkEvent) => void>()
  private seq = 0
  private auth: Auth | null = null
  private last: PublicRoom | null = null
  private pinger: ReturnType<typeof setInterval> | null = null
  private retry: ReturnType<typeof setTimeout> | null = null
  private closed = false
  /** True once a connection worked, so later drops are retried. */
  private everOpen = false

  constructor(public readonly code: string) {}

  setAuth(auth: Auth) {
    this.auth = auth
    if (!this.pinger)
      this.pinger = setInterval(() => {
        if (this.conn?.open && this.auth)
          safeSend(this.conn, { t: 'ping', auth: this.auth })
      }, PING_MS)
  }

  private async ensure(): Promise<void> {
    if (this.closed) throw new LinkError('Veza je zatvorena.')
    if (this.conn?.open) return
    if (!this.connecting)
      this.connecting = this.connect().finally(() => {
        this.connecting = null
      })
    return this.connecting
  }

  private async connect() {
    if (!this.peer || this.peer.destroyed) {
      const Peer = await loadPeer()
      this.peer = await openPeer(Peer)
      this.peer.on('disconnected', () => {
        setTimeout(() => {
          const p = this.peer
          if (!this.closed && p && p.disconnected && !p.destroyed) p.reconnect()
        }, RECONNECT_MS)
      })
    }
    const peer = this.peer
    if (peer.disconnected) peer.reconnect()
    await new Promise<void>((resolve, reject) => {
      const conn = peer.connect(peerId(this.code), {
        reliable: true,
        serialization: 'json',
      })
      const fail = (e: LinkError) => {
        clearTimeout(timer)
        peer.off('error', onPeerError)
        conn.close()
        reject(e)
      }
      const timer = setTimeout(
        () =>
          fail(
            new LinkError(
              'Ne mogu se spojiti na domaćina. Provjeri da mu je igra otvorena.',
            ),
          ),
        CONNECT_TIMEOUT_MS,
      )
      const onPeerError = (e: { type: string }) => {
        if (e.type === 'peer-unavailable')
          fail(
            new LinkError('Soba ne postoji ili je domaćin zatvorio igru.', 404),
          )
      }
      peer.on('error', onPeerError)
      conn.on('open', () => {
        clearTimeout(timer)
        peer.off('error', onPeerError)
        this.conn = conn
        this.everOpen = true
        conn.on('data', (raw) => this.receive(raw as FromHost))
        conn.on('close', () => this.dropped(conn))
        conn.on('error', () => this.dropped(conn))
        resolve()
      })
    })
    if (this.auth) {
      // Re-announce after (re)connecting and get a fresh room right away.
      safeSend(this.conn!, { t: 'ping', auth: this.auth })
      this.request('sync').catch(() => undefined)
    }
  }

  private dropped(conn: DataConnection) {
    if (this.conn !== conn) return
    this.conn = null
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new LinkError('Veza s domaćinom je prekinuta.'))
      this.pending.delete(id)
    }
    if (this.closed || !this.everOpen) return
    this.emit({
      type: 'error',
      message: 'Veza s domaćinom je prekinuta.',
    })
    this.scheduleReconnect()
  }

  private scheduleReconnect() {
    if (this.retry || this.closed) return
    this.retry = setTimeout(() => {
      this.retry = null
      this.ensure().catch((e: unknown) => {
        if (this.closed) return
        this.emit({
          type: 'error',
          message:
            e instanceof LinkError && e.status === 404
              ? 'Domaćin trenutno nije dostupan.'
              : errorMessage(e),
        })
        this.scheduleReconnect()
      })
    }, RECONNECT_MS)
  }

  private receive(msg: FromHost) {
    if (!msg || typeof msg !== 'object') return
    if (msg.t === 'room') {
      this.last = msg.room
      this.emit({ type: 'room', room: msg.room })
    } else if (msg.t === 'res') {
      const p = this.pending.get(msg.id)
      if (!p) return
      clearTimeout(p.timer)
      this.pending.delete(msg.id)
      if (msg.ok) {
        this.last = msg.room
        p.resolve({ room: msg.room, session: msg.session })
      } else p.reject(new LinkError(msg.error, msg.status))
    } else if (msg.t === 'closed') {
      this.emit({ type: 'fatal', message: msg.reason })
      this.close()
    }
  }

  private emit(e: LinkEvent) {
    for (const fn of this.listeners) fn(e)
  }

  async request(
    action: string,
    extra: Record<string, unknown> = {},
  ): Promise<ActionResult> {
    await this.ensure()
    const conn = this.conn
    if (!conn?.open) throw new LinkError('Nema veze s domaćinom sobe.')
    const id = ++this.seq
    return new Promise<ActionResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new LinkError('Domaćin ne odgovara. Pokušaj ponovno.'))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      safeSend(conn, {
        t: 'req',
        id,
        action,
        auth: this.auth ?? undefined,
        data: extra,
      })
    })
  }

  send(action: string, extra: Record<string, unknown> = {}) {
    this.request(action, extra).catch(() => undefined)
  }

  subscribe(fn: (e: LinkEvent) => void) {
    this.listeners.add(fn)
    if (this.last) fn({ type: 'room', room: this.last })
    this.ensure().catch((e: unknown) => {
      if (e instanceof LinkError && e.status === 404 && !this.everOpen)
        fn({ type: 'fatal', message: e.message })
      else {
        fn({ type: 'error', message: errorMessage(e) })
        this.scheduleReconnect()
      }
    })
    return () => {
      this.listeners.delete(fn)
    }
  }

  close() {
    if (this.closed) return
    this.closed = true
    if (this.pinger) clearInterval(this.pinger)
    if (this.retry) clearTimeout(this.retry)
    this.conn?.close()
    this.peer?.destroy()
    if (guests.get(this.code) === this) guests.delete(this.code)
  }
}

// ───────────────────────────────── Registry ─────────────────────────────────

const hosts = new Map<string, HostRoom>()
const hostRestores = new Map<string, Promise<HostRoom>>()
const guests = new Map<string, GuestLink>()

function guestLink(code: string) {
  const c = code.toUpperCase()
  let link = guests.get(c)
  if (!link) {
    link = new GuestLink(c)
    guests.set(c, link)
  }
  return link
}

export async function createHostedRoom(
  name: string,
  avatar: number,
  s: RoomSettings,
): Promise<ActionResult & { session: Session }> {
  const { room, session } = await HostRoom.create({ name, avatar }, s)
  hosts.set(room.code, room)
  const res = await room.request('sync')
  return { room: res.room, session }
}

export async function peekRoom(code: string) {
  return (await guestLink(code).request('peek')).room
}

export async function joinGuest(code: string, name: string, avatar: number) {
  const link = guestLink(code)
  const res = await link.request('join', { name, avatar })
  if (!res.session) throw new LinkError('Ulazak u sobu nije uspio.')
  link.setAuth(res.session)
  return res as ActionResult & { session: Session }
}

/** Forget an unused guest connection (e.g. the join form was left). */
export function dropGuest(code: string) {
  guests.get(code.toUpperCase())?.close()
}

/** The link for a room screen: the in-browser host, or a connection to it. */
export function openRoom(session: Session): RoomLink {
  const code = session.code.toUpperCase()
  if (!session.host) {
    const link = guestLink(code)
    link.setAuth(session)
    return link
  }
  const existing = hosts.get(code)
  if (existing) return existing
  return lazyHost(session)
}

/** A host link that first restores the room after a page refresh. */
function lazyHost(session: Session): RoomLink {
  const code = session.code.toUpperCase()
  let ready = hostRestores.get(code)
  if (!ready) {
    ready = HostRoom.restore(session).then((h) => {
      hosts.set(code, h)
      return h
    })
    ready.finally(() => hostRestores.delete(code)).catch(() => undefined)
    hostRestores.set(code, ready)
  }
  const p = ready
  return {
    request: async (a, x) => (await p).request(a, x),
    send: (a, x) => {
      p.then(
        (h) => h.send(a, x),
        () => undefined,
      )
    },
    subscribe(fn) {
      let unsub: (() => void) | null = null
      let gone = false
      p.then(
        (h) => {
          if (!gone) unsub = h.subscribe(fn)
        },
        (e: unknown) => fn({ type: 'fatal', message: errorMessage(e) }),
      )
      return () => {
        gone = true
        unsub?.()
      }
    },
    close: () => {
      p.then(
        (h) => h.close(),
        () => undefined,
      )
    },
  }
}

// ───────────────────────────────── Helpers ─────────────────────────────────

function openPeer(Peer: typeof PeerType, id?: string): Promise<PeerType> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, PEER_OPTIONS) : new Peer(PEER_OPTIONS)
    const timer = setTimeout(() => {
      peer.destroy()
      reject(new LinkError('Nema veze. Provjeri internet i pokušaj ponovno.'))
    }, CONNECT_TIMEOUT_MS)
    peer.once('open', () => {
      clearTimeout(timer)
      resolve(peer)
    })
    peer.once('error', (e) => {
      clearTimeout(timer)
      peer.destroy()
      if (e.type === 'unavailable-id')
        reject(new LinkError('Kod sobe je zauzet.', 409))
      else if (e.type === 'browser-incompatible')
        reject(new LinkError('Ovaj preglednik ne podržava online igru.'))
      else
        reject(new LinkError('Nema veze. Provjeri internet i pokušaj ponovno.'))
    })
  })
}

function safeSend(conn: DataConnection, msg: FromHost | ToHost) {
  try {
    if (conn.open) conn.send(msg)
  } catch {
    /* the connection is going away; the reconnect logic handles it */
  }
}

function errorMessage(e: unknown) {
  return e instanceof Error && e.message ? e.message : 'Nešto je pošlo po zlu.'
}

function saveHostState(state: RoomState) {
  try {
    window.localStorage.setItem(
      HOST_STATE_KEY + state.code,
      JSON.stringify({ savedAt: Date.now(), state }),
    )
  } catch {
    /* storage full or blocked: the room still works in memory */
  }
}

function loadHostState(code: string): RoomState | null {
  try {
    const raw = window.localStorage.getItem(HOST_STATE_KEY + code.toUpperCase())
    if (!raw) return null
    const { savedAt, state } = JSON.parse(raw) as {
      savedAt: number
      state: RoomState
    }
    return Date.now() - savedAt < HOST_STATE_TTL_MS ? state : null
  } catch {
    return null
  }
}

/** Drop rooms this phone hosted long ago. */
function pruneHostStates() {
  try {
    const ls = window.localStorage
    for (let i = ls.length - 1; i >= 0; i--) {
      const key = ls.key(i)
      if (
        key?.startsWith(HOST_STATE_KEY) &&
        !loadHostState(key.slice(HOST_STATE_KEY.length))
      )
        ls.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}

function clearHostState(code: string) {
  try {
    window.localStorage.removeItem(HOST_STATE_KEY + code.toUpperCase())
  } catch {
    /* ignore */
  }
}
