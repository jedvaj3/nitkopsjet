/**
 * Room persistence (server only). Each room is a single row; writes use the
 * `version` column for optimistic concurrency and retry on conflicts, so
 * simultaneous actions from several phones never overwrite each other.
 */
import { and, eq, lt } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { rooms } from '../../db/schema.js'
import { RoomError, randomCode } from './logic'
import type { RoomState } from './types'

const ROOM_TTL_MS = 24 * 60 * 60 * 1000

export async function insertRoom(
  make: (code: string) => RoomState,
): Promise<RoomState> {
  // Opportunistic cleanup of old rooms.
  await db
    .delete(rooms)
    .where(lt(rooms.updatedAt, new Date(Date.now() - ROOM_TTL_MS)))
  for (let i = 0; i < 8; i++) {
    const code = randomCode(i < 5 ? 4 : 5)
    const state = make(code)
    const inserted = await db
      .insert(rooms)
      .values({ code, state, version: 0 })
      .onConflictDoNothing()
      .returning({ code: rooms.code })
    if (inserted.length) return state
  }
  throw new RoomError('Nije moguće kreirati sobu, pokušaj ponovno.', 503)
}

export async function readRoom(code: string): Promise<RoomState> {
  const [row] = await db.select().from(rooms).where(eq(rooms.code, code))
  if (!row) throw new RoomError('Soba ne postoji ili je istekla.', 404)
  return row.state as RoomState
}

/**
 * Load a room, apply `fn` and store the result. `fn` returns false when it
 * made no change worth storing. Retries when another request wrote first.
 */
export async function mutateRoom<T>(
  code: string,
  fn: (state: RoomState) => { changed: boolean; result: T },
): Promise<{ state: RoomState; result: T }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const [row] = await db.select().from(rooms).where(eq(rooms.code, code))
    if (!row) throw new RoomError('Soba ne postoji ili je istekla.', 404)
    const state = row.state as RoomState
    const { changed, result } = fn(state)
    if (!changed) return { state, result }
    const updated = await db
      .update(rooms)
      .set({ state, version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(rooms.code, code), eq(rooms.version, row.version)))
      .returning({ version: rooms.version })
    if (updated.length) return { state, result }
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 70))
  }
  throw new RoomError('Soba je trenutno zauzeta, pokušaj ponovno.', 503)
}
