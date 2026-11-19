import { cn } from '@/lib/utils'
import { AVATARS, type AvatarSpec } from '@/online/avatars'

export type AvatarMood = 'idle' | 'thinking' | 'happy' | 'sad' | 'neutral'

interface Props {
  id: number
  mood?: AvatarMood
  className?: string
  title?: string
}

const INK = '#1a1330'

/** Illustrated quiz contestant ("čovječuljak"), drawn in SVG. */
export function Avatar({ id, mood = 'idle', className, title }: Props) {
  const a = AVATARS[id] ?? AVATARS[0]
  return (
    <svg
      viewBox="0 0 120 130"
      className={cn('avatar overflow-visible', `av-${mood}`, className)}
      role="img"
      aria-label={title ?? a.name}
    >
      <g className="av-body">
        <Arms a={a} mood={mood} />
        {/* Torso */}
        <rect x="53" y="70" width="14" height="14" rx="4" fill={a.skin} />
        <path d="M28 130 Q28 86 60 83 Q92 86 92 130 Z" fill={a.shirt} />
        <path
          d="M50 84 L60 96 L70 84"
          fill="none"
          stroke="rgba(255,255,255,.35)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <g className="av-head">
          <HairBack a={a} />
          <circle cx="34" cy="50" r="5" fill={a.skin} />
          <circle cx="86" cy="50" r="5" fill={a.skin} />
          <circle cx="60" cy="48" r="26" fill={a.skin} />
          {a.blush && (
            <>
              <ellipse
                cx="44"
                cy="58"
                rx="5"
                ry="3"
                fill="#ff7aa2"
                opacity=".45"
              />
              <ellipse
                cx="76"
                cy="58"
                rx="5"
                ry="3"
                fill="#ff7aa2"
                opacity=".45"
              />
            </>
          )}
          {a.freckles && (
            <g fill="#a0522d" opacity=".55">
              <circle cx="44" cy="56" r="1.2" />
              <circle cx="47" cy="59" r="1.2" />
              <circle cx="42" cy="59" r="1.2" />
              <circle cx="76" cy="56" r="1.2" />
              <circle cx="73" cy="59" r="1.2" />
              <circle cx="78" cy="59" r="1.2" />
            </g>
          )}
          {a.beard && (
            <path
              d="M35 52 Q38 82 60 84 Q82 82 85 52 Q78 68 60 69 Q42 68 35 52Z"
              fill={a.hairColor}
            />
          )}
          <Face
            mood={mood}
            hideMouth={!!a.beard && mood !== 'happy' && mood !== 'sad'}
          />
          {a.mustache && (
            <path
              d="M49 59 Q55 54 60 58 Q65 54 71 59 Q65 62 60 60 Q55 62 49 59Z"
              fill={a.hairColor}
            />
          )}
          <HairFront a={a} />
          <AccessoryShape a={a} />
        </g>
        {mood === 'sad' && <Hands a={a} />}
      </g>
    </svg>
  )
}

function Arms({ a, mood }: { a: AvatarSpec; mood: AvatarMood }) {
  const arm = {
    fill: 'none',
    stroke: a.shirt,
    strokeWidth: 11,
    strokeLinecap: 'round' as const,
  }
  if (mood === 'happy')
    return (
      <g className="av-arms">
        <path d="M36 94 Q22 76 16 54" {...arm} />
        <path d="M84 94 Q98 76 104 54" {...arm} />
        <circle cx="15" cy="50" r="6.5" fill={a.skin} />
        <circle cx="105" cy="50" r="6.5" fill={a.skin} />
      </g>
    )
  if (mood === 'sad')
    return (
      <g className="av-arms">
        <path d="M36 94 Q12 70 30 34" {...arm} />
        <path d="M84 94 Q108 70 90 34" {...arm} />
      </g>
    )
  if (mood === 'thinking')
    return (
      <g className="av-arms">
        <path d="M36 94 Q28 110 28 128" {...arm} />
        <path d="M84 96 Q98 82 74 72" {...arm} />
        <circle cx="72" cy="70" r="6.5" fill={a.skin} />
      </g>
    )
  return (
    <g className="av-arms">
      <path d="M36 94 Q28 110 26 128" {...arm} />
      <path d="M84 94 Q92 110 94 128" {...arm} />
    </g>
  )
}

/** Hands clutching the head (drawn above the hair). */
function Hands({ a }: { a: AvatarSpec }) {
  return (
    <g>
      <circle
        cx="34"
        cy="30"
        r="7"
        fill={a.skin}
        stroke={INK}
        strokeOpacity=".15"
      />
      <circle
        cx="86"
        cy="30"
        r="7"
        fill={a.skin}
        stroke={INK}
        strokeOpacity=".15"
      />
    </g>
  )
}

function Face({ mood, hideMouth }: { mood: AvatarMood; hideMouth: boolean }) {
  const eye = {
    fill: 'none',
    stroke: INK,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
  }
  return (
    <g className="av-face">
      {mood === 'happy' ? (
        <>
          <path d="M46 49 Q50 43 54 49" {...eye} />
          <path d="M66 49 Q70 43 74 49" {...eye} />
        </>
      ) : mood === 'sad' ? (
        <>
          <path d="M45 41 L54 44" {...eye} strokeWidth={2.2} />
          <path d="M75 41 L66 44" {...eye} strokeWidth={2.2} />
          <path d="M46 47 L53 52 M53 47 L46 52" {...eye} strokeWidth={2.5} />
          <path d="M67 47 L74 52 M74 47 L67 52" {...eye} strokeWidth={2.5} />
        </>
      ) : (
        <g className="av-eyes">
          <ellipse cx="50" cy="48" rx="3.2" ry="3.8" fill={INK} />
          <ellipse cx="70" cy="48" rx="3.2" ry="3.8" fill={INK} />
          <circle cx="51" cy="46.5" r="1" fill="#fff" />
          <circle cx="71" cy="46.5" r="1" fill="#fff" />
          {mood === 'thinking' && (
            <>
              <path d="M45 40 L54 39" {...eye} strokeWidth={2.2} />
              <path d="M66 38 L75 40" {...eye} strokeWidth={2.2} />
            </>
          )}
        </g>
      )}
      {mood === 'happy' ? (
        <path
          d="M47 58 Q60 76 73 58 Z"
          fill={INK}
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ) : mood === 'sad' ? (
        <ellipse cx="60" cy="63" rx="5" ry="6" fill={INK} />
      ) : hideMouth ? null : mood === 'thinking' ? (
        <path d="M53 62 Q60 60 67 63" {...eye} strokeWidth={2.5} />
      ) : (
        <path d="M52 60 Q60 67 68 60" {...eye} strokeWidth={2.8} />
      )}
    </g>
  )
}

function HairBack({ a }: { a: AvatarSpec }) {
  const c = a.hairColor
  switch (a.hair) {
    case 'long':
      return (
        <path
          d="M30 46 Q30 16 60 16 Q90 16 90 46 L93 88 Q60 96 27 88 Z"
          fill={c}
        />
      )
    case 'afro':
      return <circle cx="60" cy="40" r="37" fill={c} />
    case 'ponytail':
      return (
        <ellipse
          cx="90"
          cy="60"
          rx="8"
          ry="20"
          fill={c}
          transform="rotate(-18 90 60)"
        />
      )
    case 'bun':
      return <circle cx="60" cy="16" r="11" fill={c} />
    default:
      return null
  }
}

function HairFront({ a }: { a: AvatarSpec }) {
  const c = a.hairColor
  switch (a.hair) {
    case 'short':
    case 'ponytail':
    case 'bun':
      return (
        <path
          d="M33 46 Q32 19 60 19 Q88 19 87 46 Q80 30 60 30 Q40 30 33 46Z"
          fill={c}
        />
      )
    case 'side':
      return (
        <path
          d="M33 47 Q30 18 60 18 Q90 18 87 46 Q82 27 56 31 Q42 33 33 47Z"
          fill={c}
        />
      )
    case 'long':
      return (
        <path
          d="M33 46 Q34 20 60 20 Q86 20 87 46 Q76 28 62 32 Q48 30 33 46Z"
          fill={c}
        />
      )
    case 'curly':
      return (
        <g fill={c}>
          {[
            [36, 40],
            [40, 29],
            [50, 22],
            [61, 19],
            [72, 22],
            [81, 29],
            [85, 40],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="9" />
          ))}
        </g>
      )
    case 'mohawk':
      return (
        <path d="M54 30 L50 2 L58 12 L62 0 L66 12 L72 4 L68 30 Z" fill={c} />
      )
    case 'spiky':
      return (
        <path
          d="M33 44 L34 22 L43 29 L46 13 L55 25 L61 10 L67 25 L76 13 L78 29 L87 22 L87 44 Q60 27 33 44Z"
          fill={c}
        />
      )
    case 'afro':
      return (
        <path
          d="M36 40 Q40 24 60 24 Q80 24 84 40 Q72 32 60 33 Q48 32 36 40Z"
          fill={c}
        />
      )
    case 'bald':
      return <ellipse cx="52" cy="30" rx="8" ry="3" fill="#fff" opacity=".25" />
  }
}

function AccessoryShape({ a }: { a: AvatarSpec }) {
  switch (a.accessory) {
    case 'glasses':
      return (
        <g fill="rgba(255,255,255,.15)" stroke={INK} strokeWidth="2.5">
          <circle cx="50" cy="48" r="8" />
          <circle cx="70" cy="48" r="8" />
          <path d="M58 47 Q60 45 62 47" fill="none" />
        </g>
      )
    case 'sunglasses':
      return (
        <g fill="#0b0b12" stroke="#0b0b12" strokeWidth="2">
          <rect x="40" y="42" width="17" height="11" rx="4" />
          <rect x="63" y="42" width="17" height="11" rx="4" />
          <path d="M57 46 L63 46" />
          <path
            d="M43 45 L48 45"
            stroke="#fff"
            strokeOpacity=".5"
            strokeWidth="1.5"
          />
        </g>
      )
    case 'cap':
      return (
        <g>
          <path
            d="M33 38 Q33 14 60 14 Q87 14 87 38 Z"
            fill={a.shirt}
            stroke={INK}
            strokeOpacity=".2"
          />
          <path
            d="M58 36 L104 38 Q104 44 60 42 Z"
            fill={a.shirt}
            stroke={INK}
            strokeOpacity=".3"
          />
          <circle cx="60" cy="15" r="2.5" fill="#fff" opacity=".6" />
        </g>
      )
    case 'beanie':
      return (
        <g>
          <path d="M32 38 Q32 10 60 10 Q88 10 88 38 Z" fill="#38bdf8" />
          <rect x="30" y="32" width="60" height="9" rx="4" fill="#0284c7" />
          <circle cx="60" cy="8" r="6" fill="#f0f9ff" />
        </g>
      )
    case 'crown':
      return (
        <path
          d="M40 26 L42 6 L51 17 L60 2 L69 17 L78 6 L80 26 Z"
          fill="#facc15"
          stroke="#b45309"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )
    case 'headphones':
      return (
        <g>
          <path
            d="M31 48 Q30 12 60 12 Q90 12 89 48"
            fill="none"
            stroke="#18181b"
            strokeWidth="5"
          />
          <rect x="24" y="40" width="11" height="18" rx="5" fill="#ec4899" />
          <rect x="85" y="40" width="11" height="18" rx="5" fill="#ec4899" />
        </g>
      )
    case 'bow':
      return (
        <g
          fill="#f43f5e"
          stroke="#9f1239"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="M76 22 L66 14 L66 30 Z" />
          <path d="M76 22 L86 14 L86 30 Z" />
          <circle cx="76" cy="22" r="3" />
        </g>
      )
    case 'tophat':
      return (
        <g>
          <rect x="41" y="-6" width="38" height="28" rx="3" fill="#0b0b12" />
          <rect x="41" y="14" width="38" height="5" fill="#dc2626" />
          <rect x="32" y="20" width="56" height="6" rx="3" fill="#0b0b12" />
        </g>
      )
    case 'headband':
      return (
        <path
          d="M34 34 Q60 22 86 34"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="6"
          strokeLinecap="round"
        />
      )
    default:
      return null
  }
}
