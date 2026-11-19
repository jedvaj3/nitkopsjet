import { useEffect, useState } from 'react'
import { Calendar, Check, Crown, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STANDARD_CATEGORIES } from '@/game/questions'
import { q } from '@/game/q'
import { judgeOffline } from '@/game/meaning'
import { sfx, unlockAudio } from '@/game/sound'
import type { Question } from '@/game/types'

const DAILY_SHEET_URL =
      ['https:/', 'script.google.com', 'macros', 's'].join('/') + '/' +
  'AKfycbyvdSlygi231wbW34mFxxxBLnQoG1rrVgo0iyRpoE8FBvhXTV2LtVb93AI8nGvtBDLj/exec'



const DAILY_POOL: Question[] = [
  q('daily-1', 'geografija', 'Države koje graniče s Brazilom', [
    ['Argentina', 86],
    ['Kolumbija', 68, 'Colombia'],
    ['Peru', 64],
    ['Venezuela', 58],
    ['Bolivija', 52, 'Bolivia'],
    ['Paragvaj', 48, 'Paraguay'],
    ['Urugvaj', 45, 'Uruguay'],
    ['Gvajana', 14, 'Guyana'],
    ['Surinam', 6, 'Suriname'],
    ['Francuska Gvajana', 0, 'Francuska'],
  ]),
  q('daily-2', 'sport', 'Hrvatski nogometaši koji su igrali za Real Madrid', [
    ['Luka Modrić', 96, 'Modric'],
    ['Mateo Kovačić', 78, 'Kovacic'],
    ['Davor Šuker', 74, 'Suker'],
    ['Robert Prosinečki', 52, 'Prosinecki'],
    ['Robert Jarni', 34, 'Jarni'],
    ['Igor Jovićević', 0, 'Jovicevic'],
  ]),
  q('daily-3', 'film', 'Filmovi Quentina Tarantina (kao redatelja)', [
    ['Pakleni šund', 90, 'Pulp Fiction'],
    ['Nemilosrdni gadovi', 78, 'Inglourious Basterds'],
    ['Odbjegli Django', 74, 'Django Unchained'],
    ['Kill Bill', 70, 'Kill Bill 1', 'Kill Bill 2'],
    ['Bilo jednom u Hollywoodu', 56, 'Once Upon a Time in Hollywood'],
    ['Psi iz rezervoara', 44, 'Reservoir Dogs'],
    ['Mrska osmorka', 28, 'The Hateful Eight'],
    ['Jackie Brown', 8],
    ['Otporan na smrt', 0, 'Death Proof'],
  ]),
  q('daily-4', 'geografija', 'Otoci u Jadranskom moru veći od 50 km²', [
    ['Krk', 92],
    ['Cres', 88],
    ['Brač', 86, 'Brac'],
    ['Hvar', 85],
    ['Pag', 80],
    ['Korčula', 76, 'Korcula'],
    ['Dugi otok', 58],
    ['Mljet', 52],
    ['Vis', 48],
    ['Rab', 46],
    ['Lošinj', 40, 'Losinj'],
    ['Pašman', 24, 'Pasman'],
    ['Šolta', 18, 'Solta'],
    ['Ugljan', 14],
    ['Lastovo', 6],
    ['Kornat', 0],
  ]),
  q('daily-5', 'glazba', 'Pjesme Dine Dvornika', [
    ['Afrika', 92],
    ['Ti si mi u mislima', 86],
    ['Zašto praviš slona od mene', 78, 'Zasto pravis slona od mene'],
    ['Hipnotiziran', 70],
    ['Jače manijače', 64, 'Jace manijace'],
    ['Ella E', 50],
    ['Ništa kontra Splita', 46, 'Nista kontra Splita'],
    ['Ljubav se zove imenom tvojim', 32],
    ['Tebi pripadam', 14],
    ['Nadahnuti', 4],
    ['Pelin i med', 0],
  ]),
  q('daily-6', 'znanost', 'Kemijski elementi s jednoslovnim simbolom', [
    ['Kisik', 92, 'O'],
    ['Vodik', 90, 'H'],
    ['Ugljik', 86, 'C'],
    ['Dušik', 78, 'Dusik', 'N'],
    ['Sumpor', 56, 'S'],
    ['Fosfor', 48, 'P'],
    ['Kalij', 44, 'K'],
    ['Jod', 36, 'I'],
    ['Fluor', 30, 'F'],
    ['Uranij', 24, 'Uran', 'U'],
    ['Bor', 12, 'B'],
    ['Volfram', 4, 'W'],
    ['Vanadij', 2, 'V'],
    ['Itrij', 0, 'Y'],
  ]),
  q('daily-7', 'hrvatska', 'Hrvatski nacionalni parkovi', [
    ['Plitvička jezera', 97, 'Plitvice'],
    ['Krka', 92],
    ['Kornati', 84],
    ['Brijuni', 78],
    ['Mljet', 68],
    ['Paklenica', 62],
    ['Risnjak', 44],
    ['Sjeverni Velebit', 0, 'Velebit'],
  ]),
  q('daily-8', 'opca', 'Šahovske figure (pojedinačni nazivi)', [
    ['Kralj', 96],
    ['Kraljica', 94, 'Dama'],
    ['Top', 86, 'Kula'],
    ['Lovac', 82, 'Laufer'],
    ['Skakač', 78, 'Konj', 'Skakac'],
    ['Pješak', 0, 'Pion', 'Pjesak'],
  ]),
]

interface Attempt {
  label: string
  points: number
  answerIndex: number | null
}

interface SavedState {
  date: string
  attempts: Attempt[]
  submitted: boolean
}

interface Leader {
  name: string
  points: number
  answer: string
}

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function dailyQuestion(dateKey: string): Question {
  let h = 2166136261
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return DAILY_POOL.at(Math.abs(h) % DAILY_POOL.length) ?? DAILY_POOL.at(0)!
}

function deviceId(): string {
  try {
    const k = 'nitkosjet_dev_id'
    let id = localStorage.getItem(k)
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      localStorage.setItem(k, id)
    }
    return id
  } catch {
    return 'dev_fallback'
  }
}

function loadState(dateKey: string): SavedState {
  try {
    const raw = localStorage.getItem(`ns_daily_${dateKey}`)
    if (raw) {
      const parsed = JSON.parse(raw) as SavedState
      if (parsed && parsed.date === dateKey) return parsed
    }
    if (document.cookie.includes(`ns_daily_${dateKey}=1`)) {
      return { date: dateKey, attempts: [], submitted: true }
    }
  } catch {
    // ignore
  }
  return { date: dateKey, attempts: [], submitted: false }
}

function saveState(st: SavedState) {
  try {
    localStorage.setItem(`ns_daily_${st.date}`, JSON.stringify(st))
    if (st.submitted) {
      document.cookie = `ns_daily_${st.date}=1; max-age=172800; path=/; SameSite=Lax`
    }
  } catch {
    // ignore
  }
}

export function DailyChallenge() {
  const [dateKey] = useState(() => todayKey())
  const question = dailyQuestion(dateKey)
  const cat = STANDARD_CATEGORIES.find((c) => c.id === question.category)

  const [state, setState] = useState<SavedState>(() => loadState(dateKey))
  const [guess, setGuess] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [loading, setLoading] = useState(true)

  const loadLeaders = () => {
    setLoading(true)
    fetch(DAILY_SHEET_URL)
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) setLeaders(rows)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLeaders()
  }, [])

  const best =
    state.attempts.length > 0
      ? [...state.attempts].sort((a, b) => a.points - b.points).at(0) ?? null
      : null

  const finished =
    state.submitted ||
    state.attempts.length >= 3 ||
    (best !== null && best.points === 0)

  const onGuess = (e: React.FormEvent) => {
    e.preventDefault()
    if (finished) return
    const text = guess.trim()
    if (!text) return
    unlockAudio()
    setErr(null)

    const used = state.attempts
      .map((a) => a.answerIndex)
      .filter((i): i is number => i !== null)

    const res = judgeOffline(question, text, { indexes: used, novels: [] })
    if (!res.ok) {
      setErr(res.duplicate)
      return
    }

    const v = res.verdict
    const label =
      v.answerIndex !== null
        ? (question.answers.at(v.answerIndex)?.text ?? text)
        : text

    sfx.click()
    const next: SavedState = {
      ...state,
      attempts: [
        ...state.attempts,
        { label, points: v.points, answerIndex: v.answerIndex },
      ],
    }
    setState(next)
    saveState(next)
    setGuess('')
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!best || state.submitted || sending) return
    const clean = name.trim()
    if (!clean) return
    setSending(true)
    setErr(null)
    try {
      const r = await fetch(DAILY_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          name: clean,
          points: best.points,
          answer: best.points < 100 ? best.label : '—',
          deviceId: deviceId(),
        }),
      })
      const j = await r.json().catch(() => ({ ok: true }))
      if (j && j.duplicate) {
        setErr('S ovog uređaja ili pod tim imenom je danas već odigrano!')
      }
    } catch {
      // ignore network issue
    }
    const next: SavedState = { ...state, submitted: true }
    setState(next)
    saveState(next)
    setSending(false)
    loadLeaders()
  }

  return (
    <section className="panel gold-ring mb-6 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 font-display text-xs font-black tracking-wider text-gold uppercase ring-1 ring-amber-300/40">
            <Calendar className="size-3.5" /> Ekskluzivno pitanje dana
          </span>
          {cat && (
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {cat.emoji} {cat.name}
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          3 pokušaja · 1× dnevno
        </span>
      </div>

      <h2 className="mt-3 font-display text-xl leading-snug font-black sm:text-2xl">
        {question.text}
      </h2>

      {state.attempts.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {state.attempts.map((a, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between rounded-2xl px-3.5 py-2.5 ring-1',
                a.points === 0
                  ? 'bg-amber-300/15 ring-amber-300/50'
                  : a.points < 100
                    ? 'bg-cyan-400/10 ring-cyan-400/30'
                    : 'bg-rose-500/10 ring-rose-500/30',
              )}
            >
              <span className="min-w-0 truncate pr-2 text-sm font-bold">
                {i + 1}. {a.label}
              </span>
              <span
                className={cn(
                  'shrink-0 font-display text-sm font-black tabular-nums',
                  a.points === 0
