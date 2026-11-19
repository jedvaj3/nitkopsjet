import { useMemo, useState } from 'react'
import { Crown, Loader2, RotateCcw, Settings2, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { shareText } from '@/game/engine'
import { sfx } from '@/game/sound'
import { inviteLink } from '@/online/client'
import type { RoomSettings } from '@/online/types'
import { isAdultCategory } from '@/game/questions'
import { assignTitles, podiumShareText, type PodiumEntry } from '@/game/titles'
import { Podium, TitleList } from '@/components/game/Podium'
import { InviteBox, type RoomViewProps } from './Lobby'
import { RoomSettingsForm } from './RoomSettingsForm'
import { categoryLabel } from './labels'

export function OnlineFinal({ room, me, act }: RoomViewProps) {
  const isHost = room.hostId === me
  const [busy, setBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const ranked = [...room.players].sort((a, b) => a.total - b.total)
  const places = ranked.map((p, i) =>
    i > 0 && p.total === ranked[i - 1].total ? -1 : i + 1,
  )
  for (let i = 0; i < places.length; i++)
    if (places[i] === -1) places[i] = places[i - 1]
  const winners = ranked.filter((_, i) => places[i] === 1)

  // Titles from every answer this game.
  const titles = useMemo(
    () =>
      assignTitles(
        room.players.map((p) => ({
          id: p.id,
          name: p.name,
          turns: room.rounds.flatMap((r) =>
            r.turns
              .filter((t) => t.playerId === p.id)
              .map((t) => ({
                points: t.points,
                correct: t.answerText !== null,
                adult: isAdultCategory(r.question.category),
                ms: t.ms,
                novel: t.novel,
              })),
          ),
        })),
      ),
    [room.players, room.rounds],
  )
  const entries: PodiumEntry[] = ranked.map((p, i) => ({
    id: p.id,
    name: p.name,
    total: p.total,
    place: places[i],
    avatar: p.avatar,
    title: titles[p.id],
  }))

  const share = async () => {
    const text = podiumShareText(
      `NitkoSjet — online soba ${room.code}`,
      entries,
      [
        `${categoryLabel(room.settings.categories)} · ${room.rounds.length} rundi`,
        `Uđi u sobu: ${inviteLink(room.code)}`,
      ],
    )
    const res = await shareText(text)
    if (res === 'copied')
      toast.success('Rezultat je kopiran — zalijepi ga u WhatsApp grupu!')
    else if (res === 'failed') toast.error('Dijeljenje nije uspjelo.')
  }

  const again = async () => {
    setBusy(true)
    sfx.click()
    try {
      await act('start')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="studio-floor panel rounded-3xl p-6 text-center sm:p-8">
        <p className="font-display text-xs tracking-[0.25em] text-muted-foreground uppercase">
          Konačni rezultat
        </p>
        <Crown className="animate-float mx-auto mt-3 size-9 text-gold" />
        <p className="animate-pop font-display text-3xl font-black break-words text-gold sm:text-5xl">
          {winners.map((w) => w.name).join(' & ')}
        </p>
        <p className="mt-1 text-lg">
          {winners.length > 1 ? 'dijele pobjedu!' : 'pobjeđuje!'}
        </p>

        <div className="mt-8">
          <Podium entries={entries} meId={me} />
        </div>
      </div>

      <TitleList entries={entries} />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          onClick={share}
          className="btn-neon inline-flex h-12 items-center justify-center gap-2 rounded-2xl font-bold"
        >
          <Share2 className="size-5" /> Podijeli rezultat
        </button>
        {isHost ? (
          <button
            onClick={again}
            disabled={busy}
            className="btn-gold inline-flex h-12 items-center justify-center gap-2 rounded-2xl font-bold disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
            ) : (
              <RotateCcw className="size-5" />
            )}
            Nova igra za istim stolom
          </button>
        ) : (
          <p className="flex h-12 items-center justify-center text-sm text-muted-foreground">
            Domaćin može pokrenuti novu igru…
          </p>
        )}
      </div>

      {isHost && (
        <div className="mt-4">
          <button
            onClick={() => setShowSettings((s) => !s)}
            aria-expanded={showSettings}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-4" /> Promijeni postavke za iduću igru
          </button>
          {showSettings && (
            <div className="panel mt-3 rounded-3xl p-5">
              <RoomSettingsForm
                value={room.settings}
                onChange={(s: RoomSettings) =>
                  act('settings', { settings: s }).catch((e) =>
                    toast.error(e.message),
                  )
                }
              />
            </div>
          )}
        </div>
      )}
      <div className="mt-6">
        <InviteBox code={room.code} />
      </div>
    </div>
  )
}
