/**
 * Keep the host's screen on while the room is open (Screen Wake Lock API).
 * The browser drops the lock whenever the tab is hidden, so it is taken again
 * each time the page becomes visible. Returns a function that releases it.
 * Browsers without the API simply get no lock.
 */
export function holdWakeLock(): () => void {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator))
    return () => undefined
  let sentinel: WakeLockSentinel | null = null
  let active = true

  const acquire = async () => {
    if (!active || document.visibilityState !== 'visible') return
    if (sentinel && !sentinel.released) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
    } catch {
      /* denied (battery saver, iframe…) — the game still works */
    }
  }
  const onVisible = () => {
    void acquire()
  }

  void acquire()
  document.addEventListener('visibilitychange', onVisible)
  // Some browsers refuse the first request until the user has interacted.
  document.addEventListener('pointerdown', onVisible)

  return () => {
    active = false
    document.removeEventListener('visibilitychange', onVisible)
    document.removeEventListener('pointerdown', onVisible)
    void sentinel?.release().catch(() => undefined)
    sentinel = null
  }
}
