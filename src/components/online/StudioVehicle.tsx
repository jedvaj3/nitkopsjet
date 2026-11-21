import { useEffect, useState } from 'react'
import { Avatar } from './Avatar'
import type { PublicPlayer } from '@/online/types'

export type VehicleId = 'fico' | 'police' | 'lambo' | 'heli' | 'f1' | 'ufo'

export const VEHICLES: { id: VehicleId; name: string; emoji: string }[] = [
  { id: 'fico', name: 'Zlatni Fićo', emoji: '🚗' },
  { id: 'police', name: 'Presretač', emoji: '🚓' },
  { id: 'lambo', name: 'Lambo', emoji: '🏎️' },
  { id: 'heli', name: 'Helikopter', emoji: '🚁' },
  { id: 'f1', name: 'Formula 1', emoji: '🏁' },
  { id: 'ufo', name: 'NLO', emoji: '🛸' },
]

const STORAGE_KEY = 'nitkosjet_vehicle'

export function getSavedVehicle(): VehicleId {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as VehicleId | null
    return VEHICLES.some((x) => x.id === v) ? v! : 'fico'
  } catch {
    return 'fico'
  }
}

export function setSavedVehicle(id: VehicleId) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {}
}

export function vehicleForPlayer(player: PublicPlayer, isMe: boolean): VehicleId {
  if (isMe) return getSavedVehicle()
  const idx = (player.name.length + player.avatar) % VEHICLES.length
  return VEHICLES[idx].id
}

function VehicleArt({ type, isZero }: { type: VehicleId; isZero: boolean }) {
  if (type === 'heli') {
    return (
      <svg viewBox="0 0 180 95" className="w-36 sm:w-44 drop-shadow-[0_14px_18px_rgba(0,0,0,0.85)]">
        <rect x="16" y="10" width="148" height="4" rx="2" fill="#facc15" className="origin-center animate-pulse" />
        <rect x="87" y="12" width="6" height="12" fill="#94a3b8" />
        <path d="M12 46 L62 40 L62 56 L12 52 Z" fill="#1e293b" stroke="#facc15" strokeWidth="2" />
        <circle cx="12" cy="49" r="9" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6 4" />
        <ellipse cx="96" cy="48" rx="44" ry="24" fill="#0f172a" stroke="#facc15" strokeWidth="2.5" />
        <path d="M96 26 C122 26 136 36 136 50 L96 50 Z" fill="#38bdf8" fillOpacity="0.45" />
        <path d="M66 72 L66 82 M122 72 L122 82 M52 82 L138 82" stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" />
        {isZero && <circle cx="96" cy="48" r="46" fill="none" stroke="#10b981" strokeWidth="3" className="animate-ping" />}
      </svg>
    )
  }

  if (type === 'ufo') {
    return (
      <svg viewBox="0 0 180 95" className="w-36 sm:w-44 drop-shadow-[0_14px_20px_rgba(16,185,129,0.55)]">
        <polygon points="65,62 115,62 135,92 45,92" fill="#10b981" fillOpacity="0.3" />
        <ellipse cx="90" cy="36" rx="30" ry="18" fill="#38bdf8" fillOpacity="0.55" stroke="#bae6fd" strokeWidth="2" />
        <ellipse cx="90" cy="48" rx="68" ry="16" fill="#1e293b" stroke="#10b981" strokeWidth="3" />
        <circle cx="45" cy="48" r="4" fill="#facc15" />
        <circle cx="75" cy="52" r="4" fill="#10b981" />
        <circle cx="105" cy="52" r="4" fill="#10b981" />
        <circle cx="135" cy="48" r="4" fill="#facc15" />
      </svg>
    )
  }

  const bodyColor =
    type === 'lambo' ? '#f59e0b' :
    type === 'police' ? '#1e293b' :
    type === 'f1' ? '#ef4444' : '#eab308'

  return (
    <svg viewBox="0 0 180 85" className="w-36 sm:w-44 drop-shadow-[0_12px_16px_rgba(0,0,0,0.85)]">
      {type === 'police' && (
        <g>
          <rect x="74" y="14" width="14" height="7" rx="2" fill="#ef4444" className="animate-ping" />
          <rect x="88" y="14" width="14" height="7" rx="2" fill="#3b82f6" />
        </g>
      )}
      {type === 'f1' ? (
        <path d="M14 56 L30 36 L44 36 L48 46 L112 42 L156 52 L166 60 L14 60 Z" fill={bodyColor} stroke="#fff" strokeWidth="1.5" />
      ) : type === 'lambo' ? (
        <path d="M18 58 L38 34 L98 32 L154 48 L164 58 Z" fill={bodyColor} stroke="#fef08a" strokeWidth="2" />
      ) : (
        <path d="M24 58 L36 30 L114 30 L138 44 L156 50 L156 60 L24 60 Z" fill={bodyColor} stroke="#fef08a" strokeWidth="2" />
      )}
      <polygon points="84,33 110,33 128,46 84,46" fill="#38bdf8" fillOpacity="0.65" />
      <circle cx="48" cy="62" r="14" fill="#09090b" stroke="#94a3b8" strokeWidth="3" />
      <circle cx="48" cy="62" r="5" fill="#facc15" />
      <circle cx="132" cy="62" r="14" fill="#09090b" stroke="#94a3b8" strokeWidth="3" />
      <circle cx="132" cy="62" r="5" fill="#facc15" />
    </svg>
  )
}

export function VehiclePickerBar() {
  const [selected, setSelected] = useState<VehicleId>(() => getSavedVehicle())

  const choose = (id: VehicleId) => {
    setSelected(id)
    setSavedVehicle(id)
  }

  return (
    <div className="mt-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">
        Odaberi svoje vozilo za studio
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {VEHICLES.map((v) => {
          const active = selected === v.id
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => choose(v.id)}
              className={[
                'flex flex-col items-center justify-center rounded-xl px-2 py-2 text-xs font-bold transition',
                active
                  ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-200'
                  : 'bg-slate-900/80 text-white/80 hover:bg-slate-800',
              ].join(' ')}
            >
              <span className="text-lg">{v.emoji}</span>
              <span className="mt-0.5 truncate">{v.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function StudioVehicleDrive({
  player,
  fromLeft,
  isMe,
  isZero,
  answerText,
}: {
  player: PublicPlayer
  fromLeft: boolean
  isMe: boolean
  isZero: boolean
  answerText: string | null
}) {
  const [phase, setPhase] = useState<'enter' | 'parked' | 'exit'>('enter')
  const vehicle = vehicleForPlayer(player, isMe)
  const isAir = vehicle === 'heli' || vehicle === 'ufo'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('parked'), 150)
    const t2 = setTimeout(() => setPhase('exit'), 3800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [player.id])

  const posStyle: React.CSSProperties =
    phase === 'parked'
      ? {
          left: fromLeft ? 'calc(50% - 175px)' : 'calc(50% + 175px)',
          opacity: 1,
        }
      : {
          left: fromLeft ? '-220px' : 'calc(100% + 220px)',
          opacity: 0,
        }

  return (
    <div
      style={posStyle}
      className={[
        'pointer-events-none absolute z-30 flex -translate-x-1/2 flex-col items-center transition-all duration-[1300ms] ease-in-out',
        isAir ? 'bottom-16 sm:bottom-24' : 'bottom-3',
      ].join(' ')}
    >
      {answerText && phase === 'parked' && (
        <div
          className={[
            'mb-1.5 rounded-xl px-3 py-1 text-xs font-black shadow-lg ring-1 sm:text-sm',
            isZero
              ? 'bg-emerald-500 text-slate-950 ring-emerald-200 animate-bounce'
              : 'bg-slate-900/95 text-amber-300 ring-amber-400/50',
          ].join(' ')}
        >
          {player.name}: “{answerText}”
        </div>
      )}

      {/* Blago vibriranje motora / lebdenje helikoptera dok stoji */}
      <div className={isAir ? 'animate-bounce' : 'animate-pulse'}>
        <div className="relative flex items-end justify-center">
          <Avatar
            id={player.avatar}
            mood={isZero ? 'happy' : 'thinking'}
            className="absolute -top-6 left-1/2 z-10 h-12 w-12 -translate-x-1/2 sm:-top-7 sm:h-14 sm:w-14"
          />
          <div className={fromLeft ? '' : '-scale-x-100'}>
            <VehicleArt type={vehicle} isZero={isZero} />
          </div>
          {/* Dim iz auspuha za aute */}
          {!isAir && phase === 'parked' && (
            <span
              className={[
                'absolute bottom-2 text-base opacity-75 animate-ping',
                fromLeft ? '-left-4' : '-right-4',
              ].join(' ')}
            >
              💨
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
