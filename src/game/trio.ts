/**
 * "Finale" format: every player writes 3 answers per round, then answers are
 * revealed one by one in rounds over the desks (all 1st answers, then all
 * 2nd, then all 3rd). Shared by local and online games.
 */
import { normalize } from './match'
import type { Taken, Verdict } from './meaning'

export const TRIO_SLOTS = 3
/** Seconds to type a replacement when an answer was already revealed by someone else. */
export const REPLACE_SECONDS = 15

export type RoundFormat = 'trio' | 'classic'
export const DEFAULT_FORMAT: RoundFormat = 'trio'

export const OWN_DUPLICATE_MSG = 'Već si upisao taj odgovor u jedno od polja!'
export const ROUND_DUPLICATE_MSG =
  'Sudac: Ovaj odgovor je već unesen u ovoj rundi! Upiši neki drugi odgovor.'

export const FORMAT_LABELS: Record<
  RoundFormat,
  { title: string; text: string }
> = {
  trio: {
    title: '3 odgovora u krug (Finale stil)',
    text: 'Svatko upiše 3 odgovora, a onda ih otkrivamo jedan po jedan, u krug.',
  },
  classic: {
    title: 'Klasično',
    text: '1 odgovor po rundi, igrači odgovaraju redom.',
  },
}

/** Seconds for writing all three answers, derived from the per-answer timer. */
export const trioSeconds = (timer: number) => (timer > 0 ? timer * 2 : 0)

/** Reveal order: slot-major over the seat order. */
export function trioSequence<T>(order: T[], slots = TRIO_SLOTS) {
  const seq: { player: T; slot: number }[] = []
  for (let slot = 0; slot < slots; slot++)
    for (const player of order) seq.push({ player, slot })
  return seq
}

/** Two verdicts name the same thing (same listed answer or same accepted label). */
export function sameVerdict(a: Verdict, b: Verdict) {
  if (a.answerIndex !== null) return a.answerIndex === b.answerIndex
  return !!a.novel && !!b.novel && normalize(a.novel) === normalize(b.novel)
}

/**
 * Slots whose answer repeats an earlier slot of the same player, either by
 * text or by meaning (same verdict). Empty slots are ignored.
 */
export function ownDuplicateSlots(
  inputs: string[],
  verdicts: (Verdict | null)[],
): number[] {
  const dup: number[] = []
  inputs.forEach((input, i) => {
    const n = normalize(input)
    if (!n) return
    for (let j = 0; j < i; j++) {
      if (!normalize(inputs[j])) continue
      const vi = verdicts[i]
      const vj = verdicts[j]
      const correct = (v: Verdict | null) =>
        !!v && (v.answerIndex !== null || !!v.novel)
      if (
        n === normalize(inputs[j]) ||
        (correct(vi) && correct(vj) && sameVerdict(vi!, vj!))
      ) {
        dup.push(i)
        return
      }
    }
  })
  return dup
}

/** Text-only duplicate check while typing (before anything is judged). */
export const ownTextDuplicates = (inputs: string[]) =>
  ownDuplicateSlots(
    inputs,
    inputs.map(() => null),
  )

/** Answers taken by a list of verdicts (for duplicate checks). */
export function takenFrom(verdicts: Verdict[]): Taken {
  return {
    indexes: verdicts
      .map((v) => v.answerIndex)
      .filter((i): i is number => i !== null),
    novels: verdicts.map((v) => v.novel).filter((n): n is string => !!n),
  }
}
