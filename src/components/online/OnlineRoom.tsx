import { useEffect, useState } from 'react'
import { Loader2, LogOut } from 'lucide-react'
import { clearSession } from '@/online/client'
import type { Session } from '@/online/types'
import { Lobby } from './Lobby'
import { Studio } from './Studio'
import { OnlineFinal } from './OnlineFinal'
import { useRoom } from './useRoom'

interface Props {
  session: Session
  /** The seat is gone (removed or room expired): go back to the join form. */
  onLost: () => void
  onExit: () => void
}

export function OnlineRoom({ session, onLost, onExit }: Props) {
  const { room, error, fatal, act, serverNow } = useRoom(session)
  const [leaving, setLeaving] = useState(false)
  const removed = !!room && !room.players.some((p) => p.id === session.playerId)

  useEffect(() => {
    if (removed) clearSession(session.code)
  }, [removed, session.code])

  const leave = async () => {
    if (!confirm('Napustiti sobu? Svoje mjesto za stolom gubiš.')) return
    setLeaving(true)
    try {
      await act('leave')
    } catch {
      /* leaving anyway */
    }
    clearSession(session.code)
    onExit()
  }

  if (fatal)
    return (
      <Notice title="Soba nije dostupna" text={fatal}>
        <button
          onClick={() => {
            clearSession(session.code)
            onExit()
          }}
          className="btn-gold h-12 rounded-2xl px-6 font-bold"
        >
          Natrag u izbornik
        </button>
      </Notice>
    )

  if (removed)
    return (
      <Notice
        title="Više nisi za stolom"
        text="Napustio/la si sobu ili je tvoje mjesto oslobođeno."
      >
        <button
          onClick={onLost}
          className="btn-gold h-12 rounded-2xl px-6 font-bold"
        >
          Ponovno uđi u sobu
        </button>
      </Notice>
    )

  if (!room)
    return (
      <div
        className="flex flex-col items-center gap-3 py-24 text-muted-foreground"
        role="status"
      >
        <Loader2 className="size-8 animate-spin text-neon motion-reduce:animate-none" />
        {error ?? 'Spajam se na sobu…'}
      </div>
    )

  const props = { room, me: session.playerId, act, serverNow }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {error && (
        <p
          role="status"
          className="mb-3 rounded-xl bg-rose-500/15 px-3 py-2 text-center text-sm text-rose-200 ring-1 ring-rose-500/30"
        >
          {error} Pokušavam ponovno…
        </p>
      )}
      {room.phase === 'lobby' ? (
        <Lobby {...props} />
      ) : room.phase === 'final' ? (
        <OnlineFinal {...props} />
      ) : (
        <Studio {...props} />
      )}
      <div className="mt-8 flex justify-center">
        <button
          onClick={leave}
          disabled={leaving}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-rose-300"
        >
          <LogOut className="size-4" /> Napusti sobu
        </button>
      </div>
    </div>
  )
}

function Notice({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="font-display text-2xl font-black">{title}</h1>
      <p className="mt-2 mb-6 text-muted-foreground">{text}</p>
      {children}
    </div>
  )
}
