import { useEffect, useState } from 'react'
import { Avatar } from './Avatar'
import type { PublicPlayer } from '@/online/types'

export type VehicleId = 'fico' | 'police' | 'lambo' | 'heli' | 'f1' | 'ufo'

export const VEHICLES: { id: VehicleId; name: string; emoji: string; minZeros: number }[] = [
  { id: 'fico', name: 'Zlatni Fićo', emoji: '🚗', minZeros: 0 },
  { id: 'police', name: 'Presretač', emoji: '🚓', minZeros: 1 },
  { id: 'lambo', name: 'Lambo Huracán', emoji: '🏎️', minZeros: 3 },
  { id: 'heli', name: 'TV Helikopter', emoji: '🚁', minZeros: 5 },
  { id: 'f1', name: 'Formula 1', emoji: '🏁', minZeros: 8 },
  { id: 'ufo', name: 'NLO Tanjur', emoji: '🛸', minZeros: 12 },
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
      <svg viewBox="0 0 180 95" className="w-36 sm:w-44 drop-shadow-[0_12px_16px_rgba(0,0,0,0.75)]">
        {/* Glavna elisa koja se vrti */}
        <rect x="20" y="10" width="140" height="4" rx="2" fill="#facc15" className="origin-center animate-pulse" />
        <rect x="87" y="12" width="6" height="12" fill="#94a3b8" />
        {/* Rep helikoptera */}
        <path d="M12 46 L62 40 L62 56 L12 52 Z" fill="#1e293b" stroke="#facc15" strokeWidth="2" />
        <circle cx="12" cy="49" r="9" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6 4" />
        {/* Kabina */}
        <ellipse cx="96" cy="48" rx="44" ry="24" fill="#0f172a" stroke="#facc15" strokeWidth="2.5" />
        <path d="M96 26 C122 26 136 36 136 50 L96 50 Z" fill="#38bdf8" fillOpacity="0.45" />
        {/* Skije za slijetanje */}
        <path d="M66 72 L66 82 M122 72 L122 82 M52 82 L138 82" stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" />
        {isZero && <circle cx="96" cy="48" r="46" fill="none" stroke="#10b981" strokeWidth="3" className="animate-ping" />}
      </svg>
    )
  }

  if (type === 'ufo') {
    return (
      <svg viewBox="0 0 180 95" className="w-36 sm:w-44 drop-shadow-[0_12px_18px_rgba(16,185,129,0.5)]">
        <polygon points="65,62 115,62 135,92 45,92" fill="#10b981" fillOpacity="0.28" />
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
    <svg viewBox="0 0 180 85" className="w-36 sm:w-44 drop-shadow-[0_10px_14px_rgba(0,0,0,0.8)]">
      {/* Policijska rotirka */}
      {type === 'police' && (
        <g>
          <rect x="74" y="14" width="14" height="7" rx="2" fill="#ef4444" className="animate-ping" />
          <rect x="88" y="14" width="14" height="7" rx="2" fill="#3b82f6" />
        </g>
      )}
      {/* Karoserija */}
      {type === 'f1' ? (
        <path d="M14 56 L30 36 L44 36 L48 46 L112 42 L156 52 L166 60 L14 60 Z" fill={bodyColor} stroke="#fff" strokeWidth="1.5" />
      ) : type === 'lambo' ? (
        <path d="M18 58 L38 34 L98 32 L154 48 L164 58 Z" fill={bodyColor} stroke="#fef08a" strokeWidth="2" />
      ) : (
        <path d="M24 58 L36 30 L114 30 L138 44 L156 50 L156 60 L24 60 Z" fill={bodyColor} stroke="#fef08a" strokeWidth="2" />
      )}
      {/* Vjetrobran */}
      <polygon points="84,33 110,33 128,46 84,46" fill="#38bdf8" fillOpacity="0.65" />
      {/* Kotači */}
      <circle cx="48" cy="62" r="14" fill="#09090b" stroke="#94a3b8" strokeWidth="3" />
      <circle cx="48" cy="62" r="5" fill="#facc15" />
      <circle cx="132" cy="62" r="14" fill="#09090b" stroke="#94a3b8" strokeWidth="3" />
      <circle cx="132" cy="62" r="5" fill="#facc15" />
    </svg>
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
    const t1 = setTimeout(() => setPhase('parked'), 120)
    const t2 = setTimeout(() => setPhase('exit'), 3400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [player.id])

  const offscreenClass = fromLeft
    ? '-translate-x-[160%] opacity-0'
    : 'translate-x-[160%] opacity-0'

  const parkedClass = fromLeft
    ? '-translate-x-20 sm:-translate-x-28 opacity-100'
    : 'translate-x-20 sm:translate-x-28 opacity-100'

  return (
    <div
      className={[
        'pointer-events-none absolute bottom-3 left-1/2 z-30 flex flex-col items-center transition-all duration-700 ease-out',
        isAir ? 'bottom-14 sm:bottom-20' : 'bottom-2',
        phase === 'parked' ? parkedClass : offscreenClass,
      ].join(' ')}
    >
      {answerText && (
        <div
          className={[
            'mb-1 rounded-xl px-3 py-1 text-xs font-black shadow-lg ring-1 sm:text-sm',
            isZero
              ? 'bg-emerald-500 text-slate-950 ring-emerald-200 animate-bounce'
              : 'bg-slate-900/95 text-amber-300 ring-amber-400/50',
          ].join(' ')}
        >
          {player.name}: “{answerText}”
        </div>
      )}

      <div className="relative flex items-end justify-center">
        {/* Igračev Avatar viri iz kokpita/kabine vozila */}
        <Avatar
          id={player.avatar}
          mood={isZero ? 'happy' : 'thinking'}
          className="absolute -top-6 left-1/2 z-10 h-12 w-12 -translate-x-1/2 sm:-top-7 sm:h-14 sm:w-14"
        />
        <div className={fromLeft ? '' : '-scale-x-100'}>
          <VehicleArt type={vehicle} isZero={isZero} />
        </div>
      </div>
    </div>
  )
}
