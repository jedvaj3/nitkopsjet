import { useEffect, useRef, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { matchMeaning, verdictForIndex } from '@/game/meaning'
import { OWN_DUPLICATE_MSG, TRIO_SLOTS, ownDuplicateSlots } from '@/game/trio'
import type { Question } from '@/game/types'

interface Props {
  /** For instant same-meaning checks between the three fields. */
  question?: Question
  /** Resolve with an error message (shown under the fields) or null on success. */
  onLock: (inputs: string[]) => Promise<string | null>
  secondsLeft: number | null
  /** Render as a bar fixed to the bottom of the screen (online). */
  docked?: boolean
  /** Last seconds: shake the fields. */
  panic?: boolean
}

/** Three answer fields for the "Finale" format, with own-duplicate warnings. */
export function TrioFields({
  question,
  onLock,
  secondsLeft,
  docked,
  panic,
}: Props) {
  const [inputs, setInputs] = useState<string[]>(() =>
    Array(TRIO_SLOTS).fill(''),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoLocked = useRef(false)
  const first = useRef<HTMLInputElement>(null)

  // Instant warning: same text, or the same listed answer by meaning.
  const verdicts = inputs.map((v) => {
    if (!question || !v.trim()) return null
    const idx = matchMeaning(question, v)
    return idx === null ? null : verdictForIndex(question, idx, 'baza')
  })
  const dups = ownDuplicateSlots(inputs, verdicts)
  const filled = inputs.filter((v) => v.trim()).length

  const lock = async (force = false) => {
    if (busy) return
    if (dups.length && !force) {
      setError(OWN_DUPLICATE_MSG)
      return
    }
    setBusy(true)
    setError(null)
    // When forced by the timer, duplicate fields are dropped instead (they'd score 100).
    const toSend = force
      ? inputs.map((v, i) => (dups.includes(i) ? '' : v))
      : inputs
    const err = await onLock(toSend)
    setBusy(false)
    if (err) setError(err)
  }

  useEffect(() => {
    first.current?.focus()
  }, [])

  // Lock automatically when time runs out.
  useEffect(() => {
    if (secondsLeft === 0 && !autoLocked.current) {
      autoLocked.current = true
      void lock(true)
    }
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void lock()
      }}
      className={cn(
        docked &&
          'fixed inset-x-0 bottom-0 z-20 max-h-[70dvh] overflow-y-auto border-t border-amber-300/30 bg-[#0b0920]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur',
      )}
    >
      <div className={cn(docked && 'mx-auto max-w-2xl')}>
        <div className="mb-2 flex items-center justify-between text-xs font-semibold">
          <span className="text-muted-foreground">
            Upiši do 3 odgovora · prazno polje = 100 bodova
          </span>
          {secondsLeft !== null && (
            <span
              className={cn(
                'font-display tabular-nums',
                secondsLeft <= 10 ? 'text-rose-400' : 'text-neon',
              )}
            >
              {secondsLeft} s
            </span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {inputs.map((v, i) => (
            <label key={i} className="block">
              <span className="mb-0.5 block text-[11px] font-bold text-muted-foreground">
                Odgovor {i + 1}
              </span>
              <input
                ref={i === 0 ? first : undefined}
                value={v}
                disabled={busy}
                onChange={(e) => {
                  const next = [...inputs]
                  next[i] = e.target.value
                  setInputs(next)
                  setError(null)
                }}
                maxLength={80}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={i < TRIO_SLOTS - 1 ? 'next' : 'done'}
                aria-invalid={dups.includes(i)}
                className={cn(
                  'h-12 w-full min-w-0 rounded-xl border bg-black/40 px-3 text-base font-semibold focus:ring-2 focus:outline-none',
                  panic && 'panic-shake',
                  dups.includes(i) || panic
                    ? 'border-rose-400 focus:ring-rose-400/40'
                    : 'border-amber-300/40 focus:border-amber-300 focus:ring-amber-300/40',
                )}
              />
            </label>
          ))}
        </div>
        {(dups.length > 0 || error) && (
          <p
            role="alert"
            className="mt-1.5 text-sm font-semibold text-rose-400"
          >
            {dups.length > 0 ? OWN_DUPLICATE_MSG : error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="btn-gold mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Lock className="size-5" />
          )}
          {busy
            ? 'Sudac provjerava odgovore…'
            : `Zaključaj odgovore (${filled}/${TRIO_SLOTS})`}
        </button>
      </div>
    </form>
  )
}
