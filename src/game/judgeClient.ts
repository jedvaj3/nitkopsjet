import {
  checkDuplicate,
  fallbackVerdict,
  matchExact,
  verdictForIndex,
  type Judged,
  type Taken,
} from './meaning'
import type { Question } from './types'

const TIMEOUT_MS = 9000

/**
 * Judge an answer in a local game: instant answer-list check first, then the
 * server AI judge, then the offline keyword fallback if the network fails.
 */
export async function judgeLocally(
  q: Question,
  input: string,
  taken: Taken,
): Promise<Judged> {
  const idx = matchExact(q, input)
  if (idx !== null)
    return checkDuplicate(q, verdictForIndex(q, idx, 'baza'), taken)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('/api/evaluate-answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionId: q.id,
        variant: q.variant ?? 0,
        input,
        takenIndexes: taken.indexes,
        takenNovels: taken.novels,
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as Judged
  } catch {
    return checkDuplicate(q, fallbackVerdict(q, input), taken)
  } finally {
    clearTimeout(timer)
  }
}
