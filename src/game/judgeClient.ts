import { judgeOffline, type Judged, type Taken } from './meaning'
import type { Question } from './types'

/**
 * Judge an answer in a local game, entirely in the browser: diacritics and
 * case are ignored, small typos and Croatian inflections are accepted, and
 * anything that isn't a recognisable listed answer scores 100.
 */
export async function judgeLocally(
  q: Question,
  input: string,
  taken: Taken,
): Promise<Judged> {
  return judgeOffline(q, input, taken)
}
