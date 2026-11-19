import { useEffect, useState } from 'react'
import { ArrowLeft, DoorOpen, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { sfx, unlockAudio } from '@/game/sound'
import { DEFAULT_FORMAT } from '@/game/trio'
import {
  ApiError,
  api,
  getProfile,
  getSession,
  saveProfile,
  saveSession,
} from '@/online/client'
import { AVATAR_COUNT } from '@/online/avatars'
import type { PublicRoom, RoomSettings, Session } from '@/online/types'
import { categoryLabel } from './labels'
import { AvatarPicker } from './AvatarPicker'
import { OnlineRoom } from './OnlineRoom'
import { RoomSettingsForm } from './RoomSettingsForm'

interface Props {
  /** Room code from the invite link, if any. */
  code?: string
  onCodeChange: (code: string | undefined) => void
  onExit: () => void
}

/**
 * Online entry point: create a room, or join one from an invite link —
 * nickname + character only, no sign-up.
 */
export function OnlineEntry({ code, onCodeChange, onExit }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  // Rejoin the same seat after a refresh or when re-opening the invite link.
  useEffect(() => {
    setSession(code ? getSession(code) : null)
    setChecked(true)
  }, [code])

  if (!checked) return <Loading />

  if (session && code && session.code === code.toUpperCase())
    return (
      <OnlineRoom
        session={session}
        onLost={() => setSession(null)}
        onExit={() => {
          setSession(null)
          onCodeChange(undefined)
          onExit()
        }}
      />
    )

  return (
    <EntryForm
      code={code}
      onExit={onExit}
      onEntered={(s) => {
        saveSession(s)
        setSession(s)
        onCodeChange(s.code)
      }}
    />
  )
}

function Loading() {
  return (
    <div className="flex justify-center py-24" role="status">
      <Loader2 className="size-8 animate-spin text-neon motion-reduce:animate-none" />
      <span className="sr-only">Učitavanje…</span>
    </div>
  )
}

function EntryForm({
  code,
  onExit,
  onEntered,
}: {
  code?: string
  onExit: () => void
  onEntered: (s: Session) => void
}) {
  const joining = !!code
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(0)
  const [settings, setSettings] = useState<RoomSettings>({
    categories: [],
    rounds: 5,
    timer: 30,
    format: DEFAULT_FORMAT,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PublicRoom | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    const p = getProfile()
    if (p) {
      setName(p.name)
      setAvatar(p.avatar)
    } else {
      setAvatar(Math.floor(Math.random() * AVATAR_COUNT))
    }
  }, [])

  useEffect(() => {
    if (!code) return
    let alive = true
    api
      .peek(code)
      .then((r) => alive && setPreview(r))
      .catch((e: ApiError) => alive && setPreviewError(e.message))
    return () => {
      alive = false
    }
  }, [code])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) {
      setError('Upiši nadimak.')
      return
    }
    unlockAudio()
    sfx.click()
    setBusy(true)
    setError(null)
    saveProfile({ name: n, avatar })
    try {
      const res = joining
        ? await api.join(code!, n, avatar)
        : await api.create(n, avatar, settings)
      onEntered(res.session)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nešto je pošlo po zlu.'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const host = preview?.players.find((p) => p.id === preview.hostId)

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl">
      <button
        type="button"
        onClick={onExit}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Natrag u izbornik
      </button>

      <div className="text-center">
        <p className="font-display text-xs tracking-[0.25em] text-neon uppercase">
          {joining
            ? `Soba ${code!.toUpperCase()}`
            : 'Online igra · bez prijave'}
        </p>
        <h1 className="mt-2 font-display text-3xl font-black sm:text-4xl">
          {joining ? 'Sjedni za stol' : 'Kreiraj sobu'}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {joining
            ? previewError
              ? previewError
              : preview
                ? `${host ? `${host.name} te zove u igru` : 'Ekipa te čeka'} · ${preview.players.length} za stolom · ${categoryLabel(preview.settings.categories)}`
                : 'Provjeravam sobu…'
            : 'Odaberi nadimak i lika, namjesti igru i pošalji link ekipi. Nitko se ne mora registrirati.'}
        </p>
      </div>

      <section className="panel mt-6 rounded-3xl p-5 sm:p-6">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Tvoj nadimak</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            autoFocus
            placeholder="npr. Kraljica kviza"
            className="h-12 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-lg font-semibold focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 focus:outline-none"
          />
        </label>
        <p className="mt-5 mb-2 text-sm font-bold">Odaberi svog čovječuljka</p>
        <AvatarPicker
          value={avatar}
          onChange={setAvatar}
          taken={preview?.players.map((p) => p.avatar)}
        />
      </section>

      {!joining && (
        <section className="panel mt-4 rounded-3xl p-5 sm:p-6">
          <RoomSettingsForm value={settings} onChange={setSettings} />
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 text-center text-sm font-semibold text-rose-400"
        >
          {error}
        </p>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 bg-gradient-to-t from-[#07061a] via-[#07061a]/90 to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:bg-none sm:p-0">
        <button
          type="submit"
          disabled={busy || (joining && !!previewError)}
          className="btn-gold mx-auto flex h-14 w-full max-w-md items-center justify-center gap-2 rounded-2xl font-display text-lg font-black uppercase disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
          ) : joining ? (
            <DoorOpen className="size-5" />
          ) : (
            <Sparkles className="size-5" />
          )}
          {joining ? 'Uđi za stol' : 'Kreiraj sobu'}
        </button>
      </div>
    </form>
  )
}
