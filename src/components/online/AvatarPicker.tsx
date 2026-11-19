import { cn } from '@/lib/utils'
import { AVATARS } from '@/online/avatars'
import { Avatar } from './Avatar'

interface Props {
  value: number
  onChange: (id: number) => void
  /** Avatars already used by other players (still selectable, just marked). */
  taken?: number[]
}

export function AvatarPicker({ value, onChange, taken = [] }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Odaberi svog lika"
      className="grid grid-cols-4 gap-2 sm:grid-cols-8"
    >
      {AVATARS.map((a, i) => (
        <button
          key={a.name}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={a.name}
          title={a.name}
          onClick={() => onChange(i)}
          className={cn(
            'relative flex flex-col items-center rounded-2xl bg-black/25 px-1 pt-2 pb-1 ring-1 ring-white/10 transition motion-reduce:transition-none',
            value === i ? 'gold-ring bg-amber-300/10' : 'hover:bg-white/5',
          )}
        >
          <Avatar
            id={i}
            mood={value === i ? 'happy' : 'neutral'}
            className="h-14 w-14 sm:h-16 sm:w-16"
          />
          <span className="mt-0.5 w-full truncate text-center text-[10px] font-semibold text-muted-foreground">
            {a.name}
          </span>
          {taken.includes(i) && value !== i && (
            <span
              className="absolute top-1 right-1 size-2 rounded-full bg-fuchsia-400"
              aria-hidden
            />
          )}
        </button>
      ))}
    </div>
  )
}
