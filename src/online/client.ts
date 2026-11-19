import type { PublicRoom, RoomSettings, Session } from './types'

const SESSION_KEY = 'nitkosjet:online:v1'
const PROFILE_KEY = 'nitkosjet:online-profile:v1'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function call<T>(
  init: RequestInit & { query?: string; session?: Session | null },
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init.session) {
    headers['x-player-id'] = init.session.playerId
    headers['x-player-token'] = init.session.token
  }
  let res: Response
  try {
    res = await fetch(`/api/room${init.query ?? ''}`, {
      ...init,
      headers,
      cache: 'no-store',
    })
  } catch {
    throw new ApiError('Nema veze s poslužiteljem. Provjeri internet.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new ApiError(data.error ?? 'Nešto je pošlo po zlu.', res.status)
  return data as T
}

export const api = {
  get: (session: Session) =>
    call<PublicRoom>({
      method: 'GET',
      query: `?code=${encodeURIComponent(session.code)}`,
      session,
    }),
  peek: (code: string) =>
    call<PublicRoom>({
      method: 'GET',
      query: `?code=${encodeURIComponent(code)}`,
    }),
  create: (name: string, avatar: number, settings: RoomSettings) =>
    call<{ room: PublicRoom; session: Session }>({
      method: 'POST',
      body: JSON.stringify({ action: 'create', name, avatar, settings }),
    }),
  join: (code: string, name: string, avatar: number) =>
    call<{ room: PublicRoom; session: Session }>({
      method: 'POST',
      body: JSON.stringify({ action: 'join', code, name, avatar }),
    }),
  act: (
    session: Session,
    action: string,
    extra: Record<string, unknown> = {},
  ) =>
    call<{ room: PublicRoom }>({
      method: 'POST',
      body: JSON.stringify({ action, ...session, ...extra }),
    }),
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Sessions per room code, so a refresh or re-opened link rejoins the same seat. */
export function getSession(code: string): Session | null {
  const all = readJson<Record<string, Session>>(SESSION_KEY) ?? {}
  return all[code.toUpperCase()] ?? null
}

export function saveSession(s: Session) {
  const all = readJson<Record<string, Session>>(SESSION_KEY) ?? {}
  all[s.code] = s
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export function clearSession(code: string) {
  const all = readJson<Record<string, Session>>(SESSION_KEY) ?? {}
  delete all[code.toUpperCase()]
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

export interface OnlineProfile {
  name: string
  avatar: number
}

export function getProfile(): OnlineProfile | null {
  return readJson<OnlineProfile>(PROFILE_KEY)
}

export function saveProfile(p: OnlineProfile) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

export const inviteLink = (code: string) =>
  `${typeof window !== 'undefined' ? window.location.origin : 'https://nitkosjet.fun'}/?soba=${code}`
