/**
 * Questions played on this device, kept in localStorage so repeats are
 * avoided across sessions until a category has been played through.
 * `counts` remembers how often each question was played — repeats get a
 * rotated 0-point answer (see rotate.ts).
 */
const KEY = 'nitkosjet:played:v2'

interface History {
  played: string[]
  counts: Record<string, number>
}

function read(): History {
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(KEY) ?? 'null',
    ) as Partial<History> | null
    return { played: raw?.played ?? [], counts: raw?.counts ?? {} }
  } catch {
    return { played: [], counts: {} }
  }
}

function write(h: History) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(h))
  } catch {
    /* storage blocked — repeats are possible, nothing else breaks */
  }
}

export function getPlayed(): Set<string> {
  return new Set(read().played)
}

export function setPlayed(ids: Set<string>) {
  write({ ...read(), played: [...ids] })
}

/** How many times each question has been played on this device. */
export function getPlayCounts(): Record<string, number> {
  return read().counts
}

export function addPlays(ids: string[]) {
  const h = read()
  for (const id of ids) h.counts[id] = (h.counts[id] ?? 0) + 1
  write(h)
}
