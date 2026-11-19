import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { bodova } from '@/game/engine'
import { fireConfetti } from '@/game/confetti'
import { sfx } from '@/game/sound'
import type { PodiumEntry } from '@/game/titles'
import { Avatar } from '@/components/online/Avatar'

const STEP = [
  {
    h: 'h-28 sm:h-36',
    bg: 'from-amber-300/40 to-amber-500/10 ring-amber-300/60',
    medal: '🥇',
    label: '1.',
  },
  {
    h: 'h-20 sm:h-28',
    bg: 'from-slate-200/30 to-slate-400/10 ring-slate-300/50',
    medal: '🥈',
    label: '2.',
  },
  {
    h: 'h-14 sm:h-20',
    bg: 'from-orange-400/30 to-orange-700/10 ring-orange-400/50',
    medal: '🥉',
    label: '3.',
  },
]

interface Props {
  /** Sorted by place (lowest total first). */
  entries: PodiumEntry[]
  meId?: string
}

/** Winners' podium (2–1–3) with characters, totals and fun titles; others listed below. */
export function Podium({ entries, meId }: Props) {
  const top = entries.slice(0, 3)
  const rest = entries.slice(3)
  // Visual order: 2nd, 1st, 3rd.
  const visual = [top[1], top[0], top[2]].filter(Boolean) as PodiumEntry[]

  useEffect(() => {
    sfx.podium()
    fireConfetti(3000)
  }, [])

  return (
    <div>
      <ol
        className="flex items-end justify-center gap-2 sm:gap-4"
        aria-label="Pobjedničko postolje"
      >
        {visual.map((e) => {
          const step = STEP[Math.min(2, e.place - 1)]
          const rank = top.indexOf(e)
          return (
            <li
              key={e.id}
              className="flex w-1/3 max-w-44 min-w-0 flex-col items-center"
            >
              <Avatar
                id={e.avatar ?? 0}
                mood={e.place === 1 ? 'happy' : 'idle'}
                className={cn(
                  'relative z-10 -mb-2',
                  e.place === 1
                    ? 'h-24 w-24 sm:h-28 sm:w-28'
                    : 'h-16 w-16 sm:h-20 sm:w-20',
                )}
              />
              <p className="w-full truncate text-center text-sm font-bold sm:text-base">
                {e.name}
                {e.id === meId && (
                  <span className="text-muted-foreground"> (ti)</span>
                )}
              </p>
              {e.title && (
                <p
                  className="w-full truncate text-center text-[11px] font-semibold text-gold sm:text-xs"
                  title={e.title.text}
                >
                  {e.title.emoji} {e.title.name}
                </p>
              )}
              <div
                className={cn(
                  'podium-rise mt-1 flex w-full flex-col items-center justify-start rounded-t-2xl bg-gradient-to-b pt-2 ring-1',
                  step.h,
                  step.bg,
                )}
                style={{ animationDelay: `${(2 - rank) * 180}ms` }}
              >
                <span
                  className="text-2xl sm:text-3xl"
                  aria-label={`${e.place}. mjesto`}
                >
                  {step.medal}
                </span>
                <span className="font-display text-xl font-black tabular-nums sm:text-2xl">
                  {e.total}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {bodova(e.total)}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      {rest.length > 0 && (
        <ol className="mt-4 space-y-1.5">
          {rest.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 ring-1 ring-white/5"
            >
              <span className="w-6 font-display font-black text-muted-foreground">
                {e.place}.
              </span>
              <Avatar id={e.avatar ?? 0} mood="neutral" className="h-9 w-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{e.name}</span>
                {e.title && (
                  <span className="block truncate text-[11px] text-gold">
                    {e.title.emoji} {e.title.name}
                  </span>
                )}
              </span>
              <span className="font-display font-black tabular-nums">
                {e.total}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** "Titule srama" list with explanations. */
export function TitleList({ entries }: { entries: PodiumEntry[] }) {
  const withTitles = entries.filter((e) => e.title)
  if (!withTitles.length) return null
  return (
    <div className="panel mt-6 rounded-2xl p-4 sm:p-5">
      <h3 className="mb-3 font-display text-sm font-bold tracking-wider text-gold uppercase">
        Titule srama
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {withTitles.map((e) => (
          <li
            key={e.id}
            className="flex items-start gap-3 rounded-xl bg-black/25 px-3 py-2 ring-1 ring-white/5"
          >
            <span className="text-2xl" aria-hidden>
              {e.title!.emoji}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">
                {e.name}: <span className="text-gold">{e.title!.name}</span>
              </span>
              <span className="block text-xs text-muted-foreground">
                {e.title!.text}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
