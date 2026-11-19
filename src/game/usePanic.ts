import { useEffect } from 'react'
import { sfx } from './sound'

export const PANIC_SECONDS = 10

/**
 * Last-10-seconds pressure: returns whether panic mode is on and, when
 * `audible`, plays a heartbeat that speeds up (every second, then twice a
 * second in the last 5 s) and vibrates the phone lightly.
 */
export function usePanic(secondsLeft: number | null, audible: boolean) {
  const panic =
    secondsLeft !== null && secondsLeft > 0 && secondsLeft <= PANIC_SECONDS
  const fast = panic && secondsLeft! <= 5
  useEffect(() => {
    if (!panic || !audible) return
    sfx.heartbeat()
    navigator.vibrate?.(40)
    if (!fast) return
    const id = setTimeout(() => sfx.heartbeat(), 500)
    return () => clearTimeout(id)
  }, [panic, fast, audible, secondsLeft])
  return { panic, fast }
}
