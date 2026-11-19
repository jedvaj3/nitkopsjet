import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api } from '@/online/client'
import {
  POLL_MS,
  type PublicRoom,
  type Reaction,
  type ReactionEmoji,
  type Session,
} from '@/online/types'

/** How long one's own reaction is shown locally before the server copy takes over. */
const OWN_REACTION_MS = 2500

/**
 * Polls the room every 4 s while the tab is visible (no polling at all in the
 * background) and exposes actions. Reactions are not sent on their own: they
 * are queued and ride along with the next regular poll, and shown to the
 * sender immediately. `serverNow` converts the local clock to the server clock.
 */
export function useRoom(session: Session) {
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [own, setOwn] = useState<Reaction[]>([])
  const offset = useRef(0)
  const latest = useRef<PublicRoom | null>(null)
  const queued = useRef<ReactionEmoji[]>([])
  const ownSeq = useRef(0)
  const seenAt = useRef(new Map<number, number>())

  const apply = useCallback((r: PublicRoom) => {
    const cur = latest.current
    // Ignore responses that arrive out of order.
    if (cur && r.game === cur.game && r.seq < cur.seq) return
    offset.current = r.now - Date.now()
    // Polling is slow (4 s), so a reaction's on-screen clock starts when this
    // phone first receives it rather than when it was sent.
    const seen = seenAt.current
    const reactions = r.reactions.map((x) => {
      if (!seen.has(x.id)) seen.set(x.id, Math.max(x.at, r.now - 400))
      return { ...x, at: seen.get(x.id)! }
    })
    if (seen.size > 200) seen.delete(seen.keys().next().value!)
    const stamped = { ...r, reactions }
    latest.current = stamped
    setRoom(stamped)
    setError(null)
  }, [])

  useEffect(() => {
    let alive = true
    let busy = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      clearTimeout(timer)
      if (document.hidden || busy) return
      busy = true
      const emojis = queued.current
      queued.current = []
      try {
        const r = await api.get(session, emojis)
        if (alive) apply(r)
      } catch (e) {
        if (!alive) return
        if (e instanceof ApiError && e.status === 404) {
          setFatal(e.message)
          return
        }
        setError(e instanceof Error ? e.message : 'Veza je prekinuta.')
      } finally {
        busy = false
      }
      if (alive && !document.hidden) timer = setTimeout(poll, POLL_MS)
    }
    const onVisible = () => {
      if (document.hidden) clearTimeout(timer)
      else poll()
    }
    poll()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [session, apply])

  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      if (action === 'react') {
        const cur = latest.current
        const to = cur?.currentPlayerId
        if (cur && to) {
          queued.current = [...queued.current, extra.emoji as ReactionEmoji]
          const r: Reaction = {
            id: -++ownSeq.current,
            from: session.playerId,
            to,
            emoji: extra.emoji as ReactionEmoji,
            at: Date.now() + offset.current,
          }
          setOwn((list) => [...list, r])
          setTimeout(
            () => setOwn((list) => list.filter((x) => x.id !== r.id)),
            OWN_REACTION_MS,
          )
        }
        if (!cur) throw new ApiError('Soba se još učitava.', 0)
        return cur
      }
      const { room } = await api.act(session, action, extra)
      apply(room)
      return room
    },
    [session, apply],
  )

  const serverNow = useCallback(() => Date.now() + offset.current, [])

  // Others' reactions come from the server; one's own are shown locally at once.
  const merged = useMemo<PublicRoom | null>(
    () =>
      room && {
        ...room,
        reactions: [
          ...room.reactions.filter((r) => r.from !== session.playerId),
          ...own,
        ],
      },
    [room, own, session.playerId],
  )

  return { room: merged, error, fatal, act, serverNow }
}
