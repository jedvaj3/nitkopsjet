import { createHostedRoom, joinGuest, peekRoom } from './peer'
import type { RoomSettings, Session } from './types'

const SESSION_KEY = 'nitkosjet:online:v1'
const PROFILE_KEY = 'nitkosjet:online-profile:v1'

export { LinkError as ApiError } from './peer'

/**
 * Room actions. There is no server: the host's browser runs the room and the
 * other phones talk to it directly over WebRTC (see `peer.ts`).
 */
export const api = {
  peek: (code: string) => peekRoom(code),
  create: (name: string, avatar: number, settings: RoomSettings) =>
    createHostedRoom(name, avatar, settings),
  join: (code: string, name: string, avatar: number) =>
    joinGuest(code, name, avatar),
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
