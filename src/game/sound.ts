/** Tiny Web Audio synth — every sound is generated, no audio files. */

let ctx: AudioContext | null = null
let muted = false

export function setMuted(value: boolean) {
  muted = value
}
export function isMuted() {
  return muted
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || muted) return null
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Call from a user gesture so iOS/Safari unlocks audio. */
export function unlockAudio() {
  audio()
}

function tone(
  freq: number,
  duration: number,
  {
    type = 'sine',
    volume = 0.15,
    delay = 0,
    slideTo,
  }: {
    type?: OscillatorType
    volume?: number
    delay?: number
    slideTo?: number
  } = {},
) {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + delay
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

let noiseBuf: AudioBuffer | null = null
function noise(ac: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

/** A burst of filtered noise — the building block for crowd sounds. */
function hiss(
  duration: number,
  {
    freq = 1000,
    q = 1,
    volume = 0.1,
    delay = 0,
    sweepTo,
    type = 'bandpass',
    attack = 0.005,
  }: {
    freq?: number
    q?: number
    volume?: number
    delay?: number
    sweepTo?: number
    type?: BiquadFilterType
    attack?: number
  } = {},
) {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + delay
  const src = ac.createBufferSource()
  src.buffer = noise(ac)
  src.loop = true
  const filter = ac.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(freq, t)
  if (sweepTo)
    filter.frequency.exponentialRampToValueAtTime(sweepTo, t + duration)
  filter.Q.value = q
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  src.connect(filter).connect(gain).connect(ac.destination)
  src.start(t, Math.random())
  src.stop(t + duration + 0.05)
}

/** Many short claps spread over time, swelling then fading. */
function applause(seconds = 2.6, volume = 0.09) {
  const claps = Math.round(seconds * 38)
  for (let i = 0; i < claps; i++) {
    const at = Math.random() * seconds
    const swell = Math.sin(Math.PI * Math.min(1, at / seconds + 0.15))
    hiss(0.05 + Math.random() * 0.04, {
      freq: 1200 + Math.random() * 1800,
      q: 0.8,
      volume: volume * (0.4 + swell * 0.6) * (0.6 + Math.random() * 0.4),
      delay: at,
    })
  }
}

/** Crowd vowel ("ooh" up / "aww" down): voiced tones plus breathy noise. */
function crowd(from: number, to: number, seconds: number, volume: number) {
  ;[0, 0.07, 0.13, 0.21, 0.29].forEach((detune, i) =>
    tone(from * (1 + detune), seconds, {
      type: 'sawtooth',
      volume: volume * 0.18,
      slideTo: to * (1 + detune),
      delay: i * 0.015,
    }),
  )
  hiss(seconds, {
    freq: from * 4,
    sweepTo: to * 4,
    q: 3,
    volume: volume * 0.6,
    attack: 0.15,
  })
}

export const sfx = {
  click: () => tone(660, 0.06, { type: 'triangle', volume: 0.08 }),
  /** Countdown tick: pitch rises as the column falls toward zero. */
  tick: (value: number) =>
    tone(220 + (100 - value) * 7, 0.05, { type: 'square', volume: 0.035 }),
  /** Column stopped on a normal score. */
  stop: (value: number) => {
    const base = 330 + (100 - value) * 4
    tone(base, 0.18, { type: 'triangle', volume: 0.14 })
    tone(base * 1.5, 0.3, { type: 'triangle', volume: 0.1, delay: 0.12 })
  },
  wrong: () => {
    tone(140, 0.55, { type: 'sawtooth', volume: 0.12, slideTo: 70 })
    tone(147, 0.55, { type: 'square', volume: 0.05, slideTo: 74 })
  },
  jackpot: () => {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319]
    notes.forEach((n, i) =>
      tone(n, 0.25, { type: 'triangle', volume: 0.16, delay: i * 0.11 }),
    )
    tone(1568, 0.9, { type: 'sine', volume: 0.1, delay: notes.length * 0.11 })
  },
  timeWarning: () => tone(880, 0.08, { type: 'square', volume: 0.05 }),
  timeUp: () => tone(220, 0.7, { type: 'sawtooth', volume: 0.1, slideTo: 110 }),
  lifeLost: () => {
    tone(392, 0.2, { type: 'triangle', volume: 0.12 })
    tone(311, 0.2, { type: 'triangle', volume: 0.12, delay: 0.18 })
    tone(233, 0.45, { type: 'triangle', volume: 0.12, delay: 0.36 })
  },
  /** Audience: impressed "ooh" + applause (0–5 points). */
  crowdCheer: () => {
    crowd(220, 330, 0.9, 0.5)
    applause(2.8, 0.1)
  },
  /** Audience: disappointed "aww" + fail jingle (100 points). */
  crowdAww: () => {
    crowd(300, 170, 1.1, 0.5)
    ;[392, 370, 349, 262].forEach((n, i) =>
      tone(n, i === 3 ? 0.55 : 0.2, {
        type: 'square',
        volume: 0.05,
        delay: 0.25 + i * 0.2,
        slideTo: i === 3 ? 220 : undefined,
      }),
    )
  },
  /** Heartbeat for the last seconds ("lub-dub"). */
  heartbeat: () => {
    tone(70, 0.12, { type: 'sine', volume: 0.35, slideTo: 45 })
    tone(62, 0.12, { type: 'sine', volume: 0.25, slideTo: 40, delay: 0.17 })
    hiss(0.04, { freq: 4000, q: 2, volume: 0.03 })
  },
  /** Soft pop when a reaction emoji flies. */
  react: () => {
    tone(880 + Math.random() * 300, 0.07, {
      type: 'sine',
      volume: 0.05,
      slideTo: 1400,
    })
  },
  /** Big podium fanfare with applause. */
  podium: () => {
    const notes = [392, 523, 659, 784, 659, 784, 1047]
    notes.forEach((n, i) =>
      tone(n, i === notes.length - 1 ? 0.9 : 0.22, {
        type: 'triangle',
        volume: 0.14,
        delay: i * 0.15,
      }),
    )
    ;[523, 659, 784].forEach((n) =>
      tone(n, 1.1, {
        type: 'sine',
        volume: 0.06,
        delay: notes.length * 0.15 - 0.15,
      }),
    )
    applause(3.2, 0.08)
  },
  fanfare: () => {
    ;[392, 523, 659, 784].forEach((n, i) =>
      tone(n, 0.35, { type: 'triangle', volume: 0.13, delay: i * 0.14 }),
    )
  },
}
