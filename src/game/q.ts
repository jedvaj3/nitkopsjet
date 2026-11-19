import type { Answer, CategoryId, Question } from './types'

/**
 * Answer tuple: [displayText, points, ...alternatives].
 * An alternative starting with `~` is a keyword stem: the answer is accepted
 * when any word of the input starts with it (multi-word stems must appear as a
 * phrase), as long as only one answer matches. Useful for free-text answers.
 */
export type A = [text: string, points: number, ...alts: string[]]

export function q(
  id: string,
  category: CategoryId,
  text: string,
  answers: A[],
  opts: { hint?: string; surnames?: boolean } = {},
): Question {
  return {
    id,
    category,
    text,
    hint: opts.hint,
    surnames: opts.surnames,
    answers: answers.map(([t, points, ...alts]): Answer => ({
      text: t,
      points,
      alts,
    })),
  }
}
