import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '@/online/client'
import { openRoom } from '@/online/peer'
import type {
  PublicRoom,
  Reaction,
  ReactionEmoji,
  Session,
} from '@/online/types'

/** How long one's own reaction is shown locally before the host's copy takes over. */
const OWN_REACTION_MS = 2500

/**
 * Live room state over the PeerJS link: the host pushes every change, so
 * there is no polling. Reactions are sent straight away and shown to the
 * sender immediately. `serverNow` converts the local clock to the host clock.
 */
export function useRoom(session: Session) {
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [own, setOwn] = useState<Reaction[]>([])
  const offset = useRef(0)
  const latest = useRef<PublicRoom | null>(null)
  const ownSeq = useRef(0)
  const seenAt = useRef(new Map<number, number>())
  const link = useMemo(() => openRoom(session), [session])

  const apply = useCallback((r: PublicRoom) => {
    const cur = latest.current
    // Ignore messages that arrive out of order.
    if (cur && r.game === cur.game && r.seq < cur.seq) return
    offset.current = r.now - Date.now()
    // A reaction's on-screen clock starts when this phone first receives it.
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

  useEffect(
    () =>
      link.subscribe((e) => {
        if (e.type === 'room') apply(e.room)
        else if (e.type === 'error') setError(e.message)
        else setFatal(e.message)
      }),
    [link, apply],
  )

  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      if (action === 'react') {
        const cur = latest.current
        if (!cur) throw new ApiError('Soba se još učitava.', 0)
        const to = cur.currentPlayerId
        if (to) {
          link.send('react', extra)
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
        return cur
      }
      const { room } = await link.request(action, extra)
      apply(room)
      if (action === 'leave') link.close()
      return room
    },
    [link, session.playerId, apply],
  )

  const serverNow = useCallback(() => Date.now() + offset.current, [])

  // Others' reactions come from the host; one's own are shown locally at once.
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

  return { room: merged, error, fatal, act, serverNow, link }
}
