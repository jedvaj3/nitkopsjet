/**
 * Fun end-of-game titles ("titule srama"). Every player gets exactly one
 * title, chosen from what stood out in their game.
 */

export interface TitleTurn {
  points: number
  correct: boolean
  adult: boolean
  /** How long the answer took, if known. */
  ms?: number
  /** Accepted by the AI judge although not in the survey list. */
  novel?: boolean
}

export interface TitleInput {
  id: string
  name: string
  turns: TitleTurn[]
}

export interface Title {
  emoji: string
  name: string
  text: string
}

interface Rule extends Title {
  /** Higher = fits better; null = not eligible. */
  score: (s: Stats, all: Stats[]) => number | null
}

interface Stats {
  id: string
  answers: number
  total: number
  avg: number
  zeros: number
  hundreds: number
  obvious: number
  gems: number
  novel: number
  adultAvg: number | null
  avgMs: number | null
}

function stats(p: TitleInput): Stats {
  const t = p.turns
  const n = Math.max(1, t.length)
  const adult = t.filter((x) => x.adult)
  const timed = t.filter((x) => typeof x.ms === 'number')
  return {
    id: p.id,
    answers: t.length,
    total: t.reduce((s, x) => s + x.points, 0),
    avg: t.reduce((s, x) => s + x.points, 0) / n,
    zeros: t.filter((x) => x.correct && x.points === 0).length,
    hundreds: t.filter((x) => x.points >= 100).length,
    obvious: t.filter((x) => x.correct && x.points >= 70).length,
    gems: t.filter((x) => x.correct && x.points <= 10).length,
    novel: t.filter((x) => x.novel).length,
    adultAvg: adult.length
      ? adult.reduce((s, x) => s + x.points, 0) / adult.length
      : null,
    avgMs:
      timed.length >= Math.ceil(n / 2)
        ? timed.reduce((s, x) => s + x.ms!, 0) / timed.length
        : null,
  }
}

const max = (all: Stats[], f: (s: Stats) => number) => Math.max(...all.map(f))
const min = (all: Stats[], f: (s: Stats) => number) => Math.min(...all.map(f))

/** Rules in priority order (rarer, funnier titles first). */
const RULES: Rule[] = [
  {
    emoji: '🍀',
    name: 'Srećković',
    text: 'Pogodio/la odgovor od 0 bodova — NitkoSjet!',
    score: (s, all) =>
      s.zeros > 0 && s.zeros === max(all, (x) => x.zeros)
        ? 100 + s.zeros
        : null,
  },
  {
    emoji: '🔞',
    name: 'Kralj 18+ zone',
    text: 'Najbolji rezultat u bezobraznim pitanjima.',
    score: (s, all) => {
      if (s.adultAvg === null) return null
      const best = min(
        all.filter((x) => x.adultAvg !== null),
        (x) => x.adultAvg!,
      )
      return s.adultAvg === best && s.adultAvg < 60
        ? 90 - s.adultAvg / 10
        : null
    },
  },
  {
    emoji: '🧲',
    name: 'Magnet za stotke',
    text: 'Najviše netočnih i praznih odgovora.',
    score: (s, all) =>
      s.hundreds > 0 && s.hundreds === max(all, (x) => x.hundreds)
        ? 80 + s.hundreds
        : null,
  },
  {
    emoji: '🚶',
    name: 'Hodajući zicer',
    text: 'Stalno daje očite odgovore od 70+ bodova.',
    score: (s, all) =>
      s.obvious >= 2 &&
      s.obvious === max(all, (x) => x.obvious) &&
      s.obvious / Math.max(1, s.answers) >= 0.3
        ? 70 + s.obvious
        : null,
  },
  {
    emoji: '🤔',
    name: 'Vječni filozof',
    text: 'Najsporije odgovore u cijeloj ekipi.',
    score: (s, all) => {
      const timed = all.filter((x) => x.avgMs !== null)
      if (s.avgMs === null || timed.length < 2) return null
      return s.avgMs === max(timed, (x) => x.avgMs!) ? 60 : null
    },
  },
  {
    emoji: '💎',
    name: 'Lovac na bisere',
    text: 'Najviše skrivenih bisera do 10 bodova.',
    score: (s, all) =>
      s.gems >= 2 && s.gems === max(all, (x) => x.gems) ? 55 + s.gems : null,
  },
  {
    emoji: '🎨',
    name: 'Kreativac',
    text: 'Odgovori kojih nema u anketi, ali ih je sudac priznao.',
    score: (s, all) =>
      s.novel > 0 && s.novel === max(all, (x) => x.novel) ? 50 + s.novel : null,
  },
  {
    emoji: '⚡',
    name: 'Munja',
    text: 'Najbrži prst u studiju.',
    score: (s, all) => {
      const timed = all.filter((x) => x.avgMs !== null)
      if (s.avgMs === null || timed.length < 2) return null
      return s.avgMs === min(timed, (x) => x.avgMs!) ? 40 : null
    },
  },
]

const FALLBACKS: Title[] = [
  {
    emoji: '⚖️',
    name: 'Zlatna sredina',
    text: 'Ni zicer ni promašaj — uvijek negdje između.',
  },
  { emoji: '🎯', name: 'Tihi snajper', text: 'Bez puno buke, ali precizno.' },
  {
    emoji: '🫡',
    name: 'Hrabri pokušaj',
    text: 'Borio/la se do zadnjeg odgovora.',
  },
  { emoji: '🧊', name: 'Hladne glave', text: 'Ni tajmer ga/je nije uzrujao.' },
]

/** One title per player, keyed by player id. */
export function assignTitles(players: TitleInput[]): Record<string, Title> {
  const all = players.map(stats)
  const out: Record<string, Title> = {}
  const used = new Set<string>()
  // Best (rule, player) pairs first, each rule and player used once.
  const pairs: { rule: Rule; id: string; score: number }[] = []
  RULES.forEach((rule, i) => {
    for (const s of all) {
      const score = rule.score(s, all)
      if (score !== null)
        pairs.push({ rule, id: s.id, score: score - i * 0.01 })
    }
  })
  pairs.sort((a, b) => b.score - a.score)
  for (const p of pairs) {
    if (out[p.id] || used.has(p.rule.name)) continue
    out[p.id] = { emoji: p.rule.emoji, name: p.rule.name, text: p.rule.text }
    used.add(p.rule.name)
  }
  let f = 0
  for (const s of all) {
    if (out[s.id]) continue
    // Prefer a fitting fallback: precise low scorers are snipers, others golden middle.
    const pick =
      s.avg < 30 ? FALLBACKS[1] : s.avg < 60 ? FALLBACKS[0] : FALLBACKS[2]
    out[s.id] = used.has(pick.name)
      ? FALLBACKS[(f++ + 3) % FALLBACKS.length]
      : pick
    used.add(out[s.id].name)
  }
  return out
}

export interface PodiumEntry {
  id: string
  name: string
  total: number
  place: number
  title?: Title
  avatar?: number
}

const MEDALS = ['🥇', '🥈', '🥉']

/** WhatsApp-friendly summary of the podium, totals and titles. */
export function podiumShareText(
  heading: string,
  entries: PodiumEntry[],
  footer: string[],
) {
  const lines = [`🏆 ${heading}`, '']
  for (const e of entries) {
    const medal = MEDALS[e.place - 1] ?? `${e.place}.`
    lines.push(
      `${medal} ${e.name} — ${e.total} bod.${e.title ? `  ${e.title.emoji} ${e.title.name}` : ''}`,
    )
  }
  lines.push('', '(manje bodova = bolje)', ...footer)
  return lines.join('\n')
}
