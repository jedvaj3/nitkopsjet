import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { sfx } from '@/game/sound'

interface Props {
  /** Final score to stop on (100 for a wrong answer). */
  target: number
  wrong: boolean
  onDone?: () => void
  className?: string
}

const STEP_MS = 34

/**
 * The TV-style countdown column: starts full at 100 and drains toward the
 * player's score, ticking as it goes.
 */
export function ScoreColumn({ target, wrong, onDone, className }: Props) {
  const [value, setValue] = useState(100)
  const [done, setDone] = useState(false)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    let current = 100
    let timer: ReturnType<typeof setTimeout>

    const finish = () => {
      setDone(true)
      if (wrong) {
        sfx.wrong()
        sfx.crowdAww()
      } else {
        if (target === 0) sfx.jackpot()
        else sfx.stop(target)
        if (target <= 5) sfx.crowdCheer()
      }
      doneRef.current?.()
    }

    if (wrong) {
      timer = setTimeout(finish, 700)
      return () => clearTimeout(timer)
    }

    const step = () => {
      if (current <= target) return finish()
      current -= 1
      setValue(current)
      if (current % 2 === 0) sfx.tick(current)
      // Ease out slightly near the end for suspense.
      const remaining = current - target
      const delay = remaining < 6 ? STEP_MS + (6 - remaining) * 22 : STEP_MS
      timer = setTimeout(step, delay)
    }
    timer = setTimeout(step, 450)
    return () => clearTimeout(timer)
  }, [target, wrong])

  const gold = done && !wrong && target === 0
  const pct = wrong ? 100 : value

  return (
    <div className={cn('flex items-stretch gap-3', className)}>
      <div className="flex flex-col justify-between py-1 text-[10px] font-semibold tabular-nums text-muted-foreground/70 sm:text-xs">
        {[100, 75, 50, 25, 0].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="column-track relative w-20 overflow-hidden rounded-2xl sm:w-24">
        <div
          className={cn(
            'column-fill absolute inset-x-0 bottom-0 rounded-t-md transition-[height] duration-75 ease-linear',
            gold && 'is-gold',
            wrong && done && 'is-wrong',
          )}
          style={{ height: `${Math.max(pct, gold ? 100 : 1.5)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              'font-display text-4xl font-black tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] sm:text-5xl',
              gold ? 'text-[#1a1000]' : 'text-white',
            )}
          >
            {wrong ? (done ? '100' : '…') : value}
          </span>
        </div>
      </div>
    </div>
  )
}
