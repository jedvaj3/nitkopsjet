import { useEffect, useState } from 'react'
import { Avatar } from './Avatar'
import type { PublicPlayer } from '@/online/types'

export type VehicleId = 'fico' | 'police' | 'lambo' | 'heli' | 'f1' | 'ufo'

export const VEHICLES: { id: VehicleId; name: string; emoji: string }[] = [
  { id: 'fico', name: 'Fićo', emoji: '🚗' },
  { id: 'police', name: 'Policija', emoji: '🚓' },
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

function playVehicleSound(type: VehicleId) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    if (type === 'police') {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(680, now)
      osc.frequency.linearRampToValueAtTime(920, now + 0.35)
      osc.frequency.linearRampToValueAtTime(680, now + 0.7)
      osc.frequency.linearRampToValueAtTime(920, now + 1.05)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3)
      osc.connect(gain)
      osc.start(now)
      osc.stop(now + 1.35)
    } else if (type === 'heli') {
      for (let i = 0; i < 14; i++) {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(75, now + i * 0.14)
        osc.frequency.exponentialRampToValueAtTime(38, now + i * 0.14 + 0.09)
        g.gain.setValueAtTime(0.14, now + i * 0.14)
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.1)
        osc.connect(g)
        g.connect(ctx.destination)
        osc.start(now + i * 0.14)
        osc.stop(now + i * 0.14 + 0.11)
      }
    } else if (type === 'ufo') {
      const osc = ctx.createOscillator()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(420, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.9)
      osc.frequency.exponentialRampToValueAtTime(310, now + 1.8)
      lfo.frequency.value = 14
      lfoGain.gain.value = 45
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      gain.gain.setValueAtTime(0.09, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.85)
      osc.connect(gain)
      osc.start(now)
      lfo.start(now)
      osc.stop(now + 1.9)
      lfo.stop(now + 1.9)
    } else {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const base = type === 'f1' ? 190 : type === 'lambo' ? 110 : 72
      const peak = type === 'f1' ? 540 : type === 'lambo' ? 320 : 165
      osc.frequency.setValueAtTime(base, now)
      osc.frequency.exponentialRampToValueAtTime(peak, now + 0.55)
      osc.frequency.exponentialRampToValueAtTime(base * 1.2, now + 1.0)
      osc.frequency.exponentialRampToValueAtTime(peak * 0.9, now + 1.45)
      gain.gain.setValueAtTime(0.09, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6)
      osc.connect(gain)
      osc.start(now)
      osc.stop(now + 1.65)
    }
  } catch {}
}

function SpinningWheel({ cx, cy, spinning }: { cx: number; cy: number; spinning: boolean }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <circle r="15" fill="#09090b" stroke="#64748b" strokeWidth="3" />
      <g className={spinning ? 'animate-spin' : ''} style={{ transformOrigin: '0px 0px', animationDuration: '0.28s' }}>
        <circle r="7" fill="#1e293b" stroke="#facc15" strokeWidth="2" />
        <line x1="-7" y1="0" x2="7" y2="0" stroke="#facc15" strokeWidth="2" />
        <line x1="0" y1="-7" x2="0" y2="7" stroke="#facc15" strokeWidth="2" />
      </g>
    </g>
  )
}
function VehicleArt({ type, isZero, showBeam, moving }: { type: VehicleId; isZero: boolean; showBeam: boolean; moving: boolean }) {
  if (type === 'heli') {
    return (
      <svg viewBox="0 0 190 105" className="w-40 sm:w-48 drop-shadow-[0_18px_20px_rgba(0,0,0,0.95)]">
        <polygon points="85,78 135,78 158,104 62,104" fill="#fef08a" fillOpacity="0.16" />
        <rect x="12" y="10" width="166" height="4" rx="2" fill="#facc15" className="origin-center animate-pulse" />
        <rect x="92" y="12" width="6" height="14" fill="#94a3b8" />
        <path d="M12 48 L66 40 L66 58 L12 54 Z" fill="#1e293b" stroke="#facc15" strokeWidth="2" />
        <circle cx="12" cy="51" r="10" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6 4" className="animate-spin" style={{ transformOrigin: '12px 51px', animationDuration: '0.3s' }} />
        <ellipse cx="102" cy="50" rx="48" ry="25" fill="#0f172a" stroke="#facc15" strokeWidth="2.5" />
        <path d="M102 27 C130 27 146 38 146 52 L102 52 Z" fill="#38bdf8" fillOpacity="0.55" />
        <path d="M70 75 L70 86 M130 75 L130 86 M54 86 L146 86" stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" />
        {isZero && <circle cx="102" cy="50" r="48" fill="none" stroke="#10b981" strokeWidth="3" className="animate-ping" />}
      </svg>
    )
  }

  if (type === 'ufo') {
    return (
      <svg viewBox="0 0 190 110" className="w-40 sm:w-48 drop-shadow-[0_14px_20px_rgba(16,185,129,0.7)]">
        {showBeam && <polygon points="66,60 124,60 150,108 40,108" fill="#10b981" fillOpacity="0.42" className="animate-pulse" />}
        <ellipse cx="95" cy="36" rx="32" ry="19" fill="#38bdf8" fillOpacity="0.6" stroke="#bae6fd" strokeWidth="2" />
        <ellipse cx="95" cy="50" rx="72" ry="17" fill="#1e293b" stroke="#10b981" strokeWidth="3" />
        <circle cx="46" cy="50" r="4" fill="#facc15" />
        <circle cx="78" cy="54" r="4" fill="#10b981" />
        <circle cx="112" cy="54" r="4" fill="#10b981" />
        <circle cx="144" cy="50" r="4" fill="#facc15" />
      </svg>
    )
  }

  const bodyColor = type === 'lambo' ? '#f59e0b' : type === 'police' ? '#1e293b' : type === 'f1' ? '#ef4444' : '#eab308'
  return (
    <svg viewBox="0 0 215 90" className="w-44 sm:w-52 drop-shadow-[0_14px_16px_rgba(0,0,0,0.95)]">
      {/* Snop farova ispred vozila */}
      <polygon points="172,50 214,40 214,66 172,58" fill="#fef08a" fillOpacity="0.24" />
      {type === 'police' && (
        <g>
          <rect x="78" y="13" width="15" height="7" rx="2" fill="#ef4444" className="animate-ping" />
          <rect x="93" y="13" width="15" height="7" rx="2" fill="#3b82f6" />
        </g>
      )}
      {type === 'f1' ? (
        <g>
          <rect x="14" y="34" width="8" height="22" rx="2" fill="#dc2626" stroke="#fff" strokeWidth="1" />
          <path d="M18 56 L36 38 L52 38 L58 46 L120 42 L166 52 L176 60 L18 60 Z" fill={bodyColor} stroke="#fff" strokeWidth="1.5" />
          <rect x="166" y="54" width="14" height="6" rx="2" fill="#fff" />
        </g>
      ) : type === 'lambo' ? (
        <g>
          <path d="M16 42 L28 42 L34 50 L20 50 Z" fill="#09090b" stroke="#facc15" strokeWidth="1.5" />
          <path d="M20 60 L42 34 L106 32 L166 49 L176 60 Z" fill={bodyColor} stroke="#fef08a" strokeWidth="2" />
          <polygon points="166,51 176,54 166,57" fill="#fef08a" />
        </g>
      ) : (
        <g>
          <path d="M24 60 L38 30 L118 30 L144 45 L166 51 L166 60 L24 60 Z" fill={bodyColor} stroke="#fef08a" strokeWidth="2" />
          <rect x="162" y="51" width="6" height="6" rx="2" fill="#fef9c3" />
        </g>
      )}
      <polygon points="88,33 116,33 136,47 88,47" fill="#38bdf8" fillOpacity="0.7" />
      <SpinningWheel cx={52} cy={63} spinning={moving} />
      <SpinningWheel cx={142} cy={63} spinning={moving} />
    </svg>
  )
}

export function VehiclePickerBar() {
  const [selected, setSelected] = useState<VehicleId>(() => getSavedVehicle())
  const choose = (id: VehicleId) => {
    setSelected(id)
    setSavedVehicle(id)
    playVehicleSound(id)
  }
  return (
    <div className="mt-4 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">Odaberi svoje vozilo za studio (klikni za zvuk)</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {VEHICLES.map((v) => {
          const active = selected === v.id
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => choose(v.id)}
              className={[
                'flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-bold transition sm:text-xs',
                active ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-200' : 'bg-slate-900/80 text-white/80 hover:bg-slate-800',
              ].join(' ')}
            >
              <span className="text-lg">{v.emoji}</span>
              <span className="mt-0.5 leading-tight">{v.name}</span>
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
  const [step, setStep] = useState<'spawn' | 'drive_in' | 'diagram' | 'drive_out' | 'done'>('spawn')
  const vehicle = vehicleForPlayer(player, isMe)
  const isAir = vehicle === 'heli' || vehicle === 'ufo'

  useEffect(() => {
    playVehicleSound(vehicle)
    const timers = [
      setTimeout(() => setStep('drive_in'), 200),
      setTimeout(() => setStep('diagram'), 1150),
      setTimeout(() => setStep('drive_out'), 3200),
      setTimeout(() => setStep('done'), 4250),
    ]
    return () => timers.forEach(clearTimeout)
  }, [player.id, answerText, vehicle])

  if (step === 'done') return null

  const deskX = fromLeft ? '15%' : '85%'
  const midX = fromLeft ? '28%' : '72%'
  const diagramX = fromLeft ? 'calc(50% - 175px)' : 'calc(50% + 175px)'

  const leftPos = step === 'spawn' || step === 'drive_out' ? deskX : step === 'drive_in' ? midX : diagramX
  const topPos = isAir ? (step === 'spawn' ? '8%' : step === 'drive_in' ? '14%' : '26%') : '68%'
  const tiltDeg =
    step === 'drive_in'
      ? vehicle === 'heli' ? (fromLeft ? 360 : -360) : (fromLeft ? -9 : 9)
      : step === 'drive_out' ? (fromLeft ? 7 : -7) : 0

  const faceRight = step === 'drive_out' ? !fromLeft : fromLeft
  const moving = step === 'drive_in' || step === 'drive_out'

  return (
    <div
      style={{
        left: leftPos,
        top: topPos,
        opacity: step === 'spawn' ? 0.35 : 1,
        transform: `translate(-50%, -50%) rotate(${tiltDeg}deg)`,
        transition: 'all 0.95s cubic-bezier(0.25, 1, 0.5, 1)',
      }}
      className="pointer-events-none absolute z-30 flex flex-col items-center"
    >
      {answerText && step === 'diagram' && (
        <div
          className={[
            'mb-1 rounded-xl px-3 py-1 text-xs font-black shadow-lg ring-1 sm:text-sm',
            isZero ? 'bg-emerald-500 text-slate-950 ring-emerald-200 animate-bounce' : 'bg-slate-900/95 text-amber-300 ring-amber-400/50',
          ].join(' ')}
        >
          {player.name}: “{answerText}”
        </div>
      )}

      {/* Blago poskakivanje ovjesa dok motor radi */}
      <div className="relative flex flex-col items-center animate-bounce" style={{ animationDuration: isAir ? '1.1s' : '0.45s' }}>
        <div className="relative z-10 -mb-7 sm:-mb-8">
          <Avatar id={player.avatar} mood={isZero ? 'happy' : 'thinking'} className="h-11 w-11 sm:h-12 sm:w-12" />
        </div>
        <div className={faceRight ? '' : '-scale-x-100'}>
          <VehicleArt
            type={vehicle}
            isZero={isZero}
            showBeam={vehicle === 'ufo' && (step === 'spawn' || step === 'drive_out')}
            moving={moving}
          />
        </div>
        {!isAir && (
          <div className={['absolute bottom-2 flex items-center gap-1', faceRight ? '-left-8' : '-right-8'].join(' ')}>
            <span className="text-lg opacity-90 animate-ping">💨</span>
            <span className="text-sm opacity-80 animate-bounce">🔥</span>
          </div>
        )}
      </div>
    </div>
  )
}
