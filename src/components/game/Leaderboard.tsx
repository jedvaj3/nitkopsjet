import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { categoryEmoji, categoryName } from '@/game/questions'
import type { LeaderboardEntry } from '@/game/storage'

export function LeaderboardList({
  entries,
  highlight,
  limit = 10,
}: {
  entries: LeaderboardEntry[]
  highlight?: LeaderboardEntry | null
  limit?: number
}) {
  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted-foreground">
        <Trophy className="mx-auto mb-2 size-6 text-gold" />
        Ljestvica je još prazna. Odigraj Solo izazov i upiši se kao prvi!
      </div>
    )
  }
  return (
    <ol className="space-y-1.5">
      {entries.slice(0, limit).map((e, i) => {
        const me = highlight && e.date === highlight.date && e.name === highlight.name
        return (
          <li
            key={`${e.date}-${i}`}
            className={cn(
              'flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 ring-1 ring-white/5',
              me && 'neon-ring',
            )}
          >
            <span
              className={cn(
                'w-6 text-center font-display text-sm font-black',
                i === 0 ? 'text-gold' : i < 3 ? 'text-neon' : 'text-muted-foreground',
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{e.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {categoryEmoji(e.category)} {categoryName(e.category)} ·{' '}
                {e.timer ? `${e.timer} s` : 'opušteno'} ·{' '}
                {new Date(e.date).toLocaleDateString('hr-HR')}
                {e.jackpots > 0 && ` · 🏆×${e.jackpots}`}
              </p>
            </div>
            <span className="font-display text-xl font-black tabular-nums">{e.score}</span>
          </li>
        )
      })}
    </ol>
  )
}
