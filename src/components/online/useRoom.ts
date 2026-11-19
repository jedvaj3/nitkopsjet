import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api } from '@/online/client'
import { POLL_MS, type PublicRoom, type Session } from '@/online/types'

/**
 * Polls the room every ~1.6 s and exposes actions. `clockOffset` converts the
 * local clock to the server clock for countdowns.
 */
export function useRoom(session: Session) {
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const offset = useRef(0)
  const latest = useRef<PublicRoom | null>(null)

  const apply = useCallback((r: PublicRoom) => {
    const cur = latest.current
    // Ignore responses that arrive out of order.
    if (cur && r.game === cur.game && r.seq < cur.seq) return
    offset.current = r.now - Date.now()
    latest.current = r
    setRoom(r)
    setError(null)
  }, [])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      clearTimeout(timer)
      try {
        const r = await api.get(session)
        if (alive) apply(r)
      } catch (e) {
        if (!alive) return
        if (e instanceof ApiError && e.status === 404) {
          setFatal(e.message)
          return
        }
        setError(e instanceof Error ? e.message : 'Veza je prekinuta.')
      }
      if (alive)
        timer = setTimeout(poll, document.hidden ? POLL_MS * 3 : POLL_MS)
    }
    const onVisible = () => {
      if (!document.hidden) poll()
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
      const { room } = await api.act(session, action, extra)
      apply(room)
      return room
    },
    [session, apply],
  )

  const serverNow = useCallback(() => Date.now() + offset.current, [])

  return { room, error, fatal, act, serverNow }
}
