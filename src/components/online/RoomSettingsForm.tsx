import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CATEGORIES, STANDARD_CATEGORIES } from '@/game/questions'
import { getPrefs, savePrefs } from '@/game/storage'
import type { CategoryId } from '@/game/types'
import { AgeGate } from '@/components/game/AgeGate'
import { FormatPicker } from '@/components/game/FormatPicker'
import {
  ROOM_ROUND_OPTIONS,
  ROOM_TIMER_OPTIONS,
  type RoomSettings,
} from '@/online/types'

interface Props {
  value: RoomSettings
  onChange: (s: RoomSettings) => void
  disabled?: boolean
}

/** Categories (multi-select, optional 18+), rounds and timer for a room. */
export function RoomSettingsForm({ value, onChange, disabled }: Props) {
  const [gate, setGate] = useState(false)

  const adult = CATEGORIES.find((c) => c.adult)!
  const has = (id: CategoryId) => value.categories.includes(id)
  const toggle = (id: CategoryId) => {
    const next = has(id)
      ? value.categories.filter((c) => c !== id)
      : [...value.categories, id]
    onChange({ ...value, categories: next })
  }
  const allStandard = !STANDARD_CATEGORIES.some((c) => has(c.id))

  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
      <div>
        <legend className="mb-2 text-sm font-bold">Kategorije</legend>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={allStandard}
            onClick={() =>
              onChange({
                ...value,
                categories: value.categories.filter((c) => c === adult.id),
              })
            }
          >
            🎲 Miks (sve)
          </Chip>
          {STANDARD_CATEGORIES.map((c) => (
            <Chip key={c.id} active={has(c.id)} onClick={() => toggle(c.id)}>
              {c.emoji} {c.name}
            </Chip>
          ))}
          <Chip
            active={has(adult.id)}
            adult
            onClick={() =>
              has(adult.id) || getPrefs().adultConfirmed
                ? toggle(adult.id)
                : setGate(true)
            }
          >
            <span className="rounded bg-rose-500 px-1 text-[10px] font-black text-white">
              18+
            </span>{' '}
            {adult.name}
          </Chip>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {value.categories.length === 1 && has(adult.id)
            ? 'Samo 18+ pitanja.'
            : has(adult.id)
              ? 'Odabrane kategorije + 18+ pitanja.'
              : 'Miks ne uključuje 18+ pitanja — njih biraš posebno.'}
        </p>
      </div>
      <FormatPicker
        value={value.format}
        onChange={(format) => onChange({ ...value, format })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-bold">Broj rundi</p>
          <div className="flex gap-2">
            {ROOM_ROUND_OPTIONS.map((n) => (
              <Chip
                key={n}
                active={value.rounds === n}
                onClick={() => onChange({ ...value, rounds: n })}
              >
                {n}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">Vrijeme za odgovor</p>
          <div className="flex gap-2">
            {ROOM_TIMER_OPTIONS.map((n) => (
              <Chip
                key={n}
                active={value.timer === n}
                onClick={() => onChange({ ...value, timer: n })}
              >
                {n} s
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <AgeGate
        open={gate}
        onCancel={() => setGate(false)}
        onConfirm={() => {
          setGate(false)
          savePrefs({ adultConfirmed: true })
          onChange({ ...value, categories: [...value.categories, adult.id] })
        }}
      />
    </fieldset>
  )
}

function Chip({
  active,
  adult,
  onClick,
  children,
}: {
  active: boolean
  adult?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition motion-reduce:transition-none',
        adult
          ? active
            ? 'bg-rose-500/20 text-rose-100 ring-2 ring-rose-400'
            : 'bg-rose-950/30 ring-rose-500/30 hover:bg-rose-500/10'
          : active
            ? 'neon-ring bg-cyan-400/10 text-neon'
            : 'bg-black/25 ring-white/10 hover:bg-white/5',
      )}
    >
      {children}
    </button>
  )
}
