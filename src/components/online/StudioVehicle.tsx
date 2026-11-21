function VehicleArt({ type, isZero, showBeam, wheelAngle }: { type: VehicleId; isZero: boolean; showBeam: boolean; wheelAngle: number }) {
  if (type === 'heli') {
    const bladeScale = Math.cos((wheelAngle * Math.PI) / 180)
    return (
      <svg viewBox="0 0 190 105" className="w-36 sm:w-44 drop-shadow-[0_18px_20px_rgba(0,0,0,0.95)]">
        <polygon points="85,78 135,78 158,104 62,104" fill="#fef08a" fillOpacity="0.14" />
        <g transform={`translate(95, 12) scale(${bladeScale}, 1)`}>
          <rect x="-82" y="-2" width="164" height="4" rx="2" fill="#facc15" />
        </g>
        <rect x="92" y="12" width="6" height="14" fill="#94a3b8" />
        <path d="M12 48 L66 40 L66 58 L12 54 Z" fill="#1e293b" stroke="#facc15" strokeWidth="2" />
        <g transform={`translate(12, 51) rotate(${wheelAngle * 1.6})`}>
          <line x1="-9" y1="0" x2="9" y2="0" stroke="#38bdf8" strokeWidth="2.5" />
          <line x1="0" y1="-9" x2="0" y2="9" stroke="#38bdf8" strokeWidth="2.5" />
        </g>
        <ellipse cx="102" cy="50" rx="48" ry="25" fill="#0f172a" stroke="#facc15" strokeWidth="2.5" />
        <path d="M102 27 C130 27 146 38 146 52 L102 52 Z" fill="#38bdf8" fillOpacity="0.55" />
        <path d="M70 75 L70 86 M130 75 L130 86 M54 86 L146 86" stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" />
        {isZero && <circle cx="102" cy="50" r="48" fill="none" stroke="#10b981" strokeWidth="3" />}
      </svg>
    )
  }

  if (type === 'ufo') {
    return (
      <svg viewBox="0 0 190 110" className="w-36 sm:w-44 drop-shadow-[0_14px_20px_rgba(16,185,129,0.65)]">
        {showBeam && <polygon points="66,60 124,60 150,108 40,108" fill="#10b981" fillOpacity="0.38" />}
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
    <svg viewBox="0 0 215 90" className="w-40 sm:w-48 drop-shadow-[0_14px_16px_rgba(0,0,0,0.95)]">
      <polygon points="172,50 214,40 214,66 172,58" fill="#fef08a" fillOpacity="0.22" />
      {type === 'police' && (
        <g>
          <rect x="78" y="13" width="15" height="7" rx="2" fill={Math.floor(wheelAngle / 90) % 2 === 0 ? '#ef4444' : '#7f1d1d'} />
          <rect x="93" y="13" width="15" height="7" rx="2" fill={Math.floor(wheelAngle / 90) % 2 === 1 ? '#3b82f6' : '#1e3a8a'} />
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
      <SpinningWheel cx={52} cy={63} angle={wheelAngle} />
      <SpinningWheel cx={142} cy={63} angle={wheelAngle} />
    </svg>
  )
}

export function VehiclePickerBar() {
  const [selected, setSelected] = useState<VehicleId>(() => getSavedVehicle())
  const [open, setOpen] = useState(false)
  const current = VEHICLES.find((v) => v.id === selected) || VEHICLES[0]

  const choose = (id: VehicleId) => {
    setSelected(id)
    setSavedVehicle(id)
    playVehicleSound(id)
    setOpen(false)
  }

  return (
    <div className="relative mt-2 flex justify-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-amber-300 ring-1 ring-white/10 transition hover:bg-white/10"
      >
        <span>{current.emoji}</span>
        <span>{current.name}</span>
        <span className="text-[10px] text-white/60">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute bottom-9 left-0 z-40 flex flex-wrap gap-1.5 rounded-2xl bg-slate-950/95 p-2 shadow-2xl ring-1 ring-amber-400/40 backdrop-blur">
          {VEHICLES.map((v) => {
            const active = selected === v.id
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => choose(v.id)}
                className={[
                  'flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition',
                  active ? 'bg-amber-400 text-slate-950' : 'bg-white/5 text-white/80 hover:bg-white/15',
                ].join(' ')}
              >
                <span>{v.emoji}</span>
                <span>{v.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

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
  const [elapsed, setElapsed] = useState(0)
  const vehicle = vehicleForPlayer(player, isMe)
  const isAir = vehicle === 'heli' || vehicle === 'ufo'

  useEffect(() => {
    playVehicleSound(vehicle)
    const start = performance.now()
    let raf = 0
    const loop = (now: number) => {
      const sec = (now - start) / 1000
      setElapsed(sec)
      if (sec < 4.8) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [player.id, answerText, vehicle])

  if (elapsed >= 4.8) return null

  const goingIn = elapsed < 1.4
  const parked = elapsed >= 1.4 && elapsed < 3.4
  const goingOut = elapsed >= 3.4

  const progress = goingIn
    ? easeInOut(elapsed / 1.4)
    : parked
      ? 1
      : 1 - easeInOut(Math.min(1, (elapsed - 3.4) / 1.4))

  const startX = fromLeft ? 14 : 86
  const endX = fromLeft ? 36 : 64
  const curX = startX + (endX - startX) * progress

  // Helikopter i NLO lete visoko po zraku (235px -> 295px) iznad svih igrača, auti voze po čistom podu (10px)!
  const curBottom = isAir
    ? 235 + Math.sin(progress * Math.PI) * 60
    : 10

  let pitch = 0
  if (goingIn) {
    const t = elapsed / 1.4
    pitch = t < 0.7 ? -3.5 : 4.5
  } else if (goingOut) {
    const t = (elapsed - 3.4) / 1.4
    pitch = t < 0.7 ? -3.5 : 3.5
  }
  if (!fromLeft) pitch = -pitch
  if (goingOut) pitch = -pitch

  const faceRight = goingOut ? !fromLeft : fromLeft
  const wheelAngle = elapsed * (parked && !isAir ? 0 : 720)
  const opacity = elapsed < 0.25 ? elapsed / 0.25 : elapsed > 4.5 ? (4.8 - elapsed) / 0.3 : 1

  return (
    <div
      style={{
        left: `${curX}%`,
        bottom: `${curBottom}px`,
        opacity,
        transform: `translateX(-50%) rotate(${pitch}deg)`,
      }}
      className="pointer-events-none absolute z-30 flex flex-col items-center"
    >
      {answerText && parked && (
        <div
          className={[
            'mb-1 rounded-xl px-3 py-1 text-xs font-black shadow-lg ring-1 sm:text-sm',
            isZero ? 'bg-emerald-500 text-slate-950 ring-emerald-200' : 'bg-slate-900/95 text-amber-300 ring-amber-400/50',
          ].join(' ')}
        >
          {player.name}: “{answerText}”
        </div>
      )}

      <div className="relative flex flex-col items-center">
        <div className="relative z-10 -mb-7 sm:-mb-8">
          <Avatar id={player.avatar} mood={isZero ? 'happy' : 'thinking'} className="h-11 w-11 sm:h-12 sm:w-12" />
        </div>
        <div className={faceRight ? '' : '-scale-x-100'}>
          <VehicleArt
            type={vehicle}
            isZero={isZero}
            showBeam={vehicle === 'ufo' && (goingIn || goingOut)}
            wheelAngle={wheelAngle}
          />
        </div>
        {!isAir && !parked && (
          <span className={['absolute bottom-2 text-base opacity-80', faceRight ? '-left-6' : '-right-6'].join(' ')}>
            💨
          </span>
        )}
      </div>
    </div>
  )
}
