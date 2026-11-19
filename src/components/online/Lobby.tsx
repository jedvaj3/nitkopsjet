import { useState } from 'react'
import { Copy, Crown, Loader2, Play, Share2, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { sfx, unlockAudio } from '@/game/sound'
import { inviteLink } from '@/online/client'
import type { PublicRoom, RoomSettings } from '@/online/types'
import { ROOM_MAX_PLAYERS } from '@/online/types'
import { Avatar } from './Avatar'
import { DEFAULT_FORMAT, FORMAT_LABELS } from '@/game/trio'
import { RoomSettingsForm } from './RoomSettingsForm'
import { categoryLabel } from './labels'

export interface RoomViewProps {
  room: PublicRoom
  me: string
  act: (action: string, extra?: Record<string, unknown>) => Promise<PublicRoom>
  serverNow: () => number
}

export function InviteBox({ code }: { code: string }) {
  const link = inviteLink(code)
  const text = `Ajmo igrati NitkoSjet! Uđi u moju sobu ${code}: ${link}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link je kopiran — pošalji ga ekipi!')
    } catch {
      toast.error('Kopiranje nije uspjelo — kod sobe je ' + code)
    }
  }
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'NitkoSjet', text, url: link })
      } catch {
        /* cancelled */
      }
    } else copy()
  }
  return (
    <div className="panel rounded-3xl p-5 text-center sm:p-6">
      <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
        Kod sobe
      </p>
      <p className="font-display text-5xl font-black tracking-[0.2em] text-gold sm:text-6xl">
        {code}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{link}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          onClick={copy}
          className="btn-neon inline-flex h-12 items-center justify-center gap-2 rounded-2xl font-bold"
        >
          <Copy className="size-5" /> Kopiraj link za pozivnicu
        </button>
        <button
          onClick={share}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/5 font-bold ring-1 ring-white/15 hover:bg-white/10"
        >
          <Share2 className="size-5" /> Podijeli
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#25d366]/15 font-bold text-[#5ef59a] ring-1 ring-[#25d366]/40 hover:bg-[#25d366]/25"
        >
          WhatsApp
        </a>
        <a
          href={`viber://forward?text=${encodeURIComponent(text)}`}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#7360f2]/15 font-bold text-[#b3a8ff] ring-1 ring-[#7360f2]/40 hover:bg-[#7360f2]/25"
        >
          Viber
        </a>
      </div>
    </div>
  )
}

export function Lobby({ room, me, act }: RoomViewProps) {
  const isHost = room.hostId === me
  const [starting, setStarting] = useState(false)

  const changeSettings = async (s: RoomSettings) => {
    try {
      await act('settings', { settings: s })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const start = async () => {
    unlockAudio()
    sfx.click()
    setStarting(true)
    try {
      await act('start')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <InviteBox code={room.code} />
        {isHost ? (
          <section className="panel rounded-3xl p-5 sm:p-6">
            <h2 className="mb-4 font-display text-base font-bold">
              Postavke igre
            </h2>
            <RoomSettingsForm value={room.settings} onChange={changeSettings} />
          </section>
        ) : (
          <section className="panel rounded-3xl p-5 text-sm sm:p-6">
            <h2 className="mb-2 font-display text-base font-bold">
              Postavke igre
            </h2>
            <p className="text-muted-foreground">
              {categoryLabel(room.settings.categories)} · {room.settings.rounds}{' '}
              rundi · {room.settings.timer} s po odgovoru
            </p>
            <p className="mt-1 font-semibold">
              {FORMAT_LABELS[room.settings.format ?? DEFAULT_FORMAT].title}
            </p>
          </section>
        )}
      </div>

      <section className="studio-floor panel rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Za stolom</h2>
          <span className="text-sm text-muted-foreground">
            {room.players.length}/{ROOM_MAX_PLAYERS}
          </span>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {room.players.map((p) => (
            <li key={p.id} className="flex flex-col items-center">
              <Avatar
                id={p.avatar}
                mood={p.id === me ? 'happy' : 'idle'}
                className="relative z-0 -mb-3 h-16 w-16 sm:h-20 sm:w-20"
              />
              <div
                className={cn(
                  'desk relative z-10 w-full rounded-xl px-2 py-1.5 text-center',
                  p.id === me && 'ring-1 ring-cyan-400/60',
                )}
              >
                <p className="flex items-center justify-center gap-1 truncate text-sm font-bold">
                  {p.id === room.hostId && (
                    <Crown
                      className="size-3.5 shrink-0 text-gold"
                      aria-label="Domaćin"
                    />
                  )}
                  <span className="truncate">{p.name}</span>
                  {!p.online && (
                    <WifiOff
                      className="size-3 shrink-0 text-muted-foreground"
                      aria-label="Nije spojen"
                    />
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {p.id === me ? 'ti' : p.online ? 'spreman/na' : 'odspojen/a'}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 text-center">
          {isHost ? (
            <>
              <button
                onClick={start}
                disabled={starting}
                className="btn-gold mx-auto flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-2xl font-display text-lg font-black uppercase disabled:opacity-60"
              >
                {starting ? (
                  <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Play className="size-5 fill-current" />
                )}
                Pokreni igru
              </button>
              {room.players.length < 2 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Pošalji link ekipi — igra je zabavnija s barem dvoje. Možeš
                  krenuti i sam/a.
                </p>
              )}
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />{' '}
              Čekamo da domaćin pokrene igru…
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
