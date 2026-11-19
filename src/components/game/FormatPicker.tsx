import { cn } from '@/lib/utils'
import { FORMAT_LABELS, type RoundFormat } from '@/game/trio'

interface Props {
  value: RoundFormat
  onChange: (f: RoundFormat) => void
}

/** Choice between "3 answers in rounds" (Finale) and classic 1 answer per round. */
export function FormatPicker({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Način odgovaranja">
      <p className="mb-2 text-sm font-bold">Način odgovaranja</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(FORMAT_LABELS) as RoundFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={value === f}
            onClick={() => onChange(f)}
            className={cn(
              'rounded-2xl bg-black/25 p-3 text-left ring-1 ring-white/10 transition motion-reduce:transition-none',
              value === f ? 'neon-ring bg-cyan-400/10' : 'hover:bg-white/5',
            )}
          >
            <span
              className={cn(
                'block text-sm font-bold',
                value === f && 'text-neon',
              )}
            >
              {FORMAT_LABELS[f].title}
              {f === 'trio' && (
                <span className="ml-1.5 rounded bg-amber-300/20 px-1 text-[10px] font-black text-amber-200 uppercase">
                  zadano
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {FORMAT_LABELS[f].text}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
