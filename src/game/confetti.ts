/** Lightweight canvas VIP gold & white fireworks burst, no dependencies. */
export function fireConfetti(durationMs = 4200) {
  if (typeof document === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '100',
  })
  document.body.appendChild(canvas)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  const g = canvas.getContext('2d')
  if (!g) return
  g.scale(dpr, dpr)

  const palettes = [
    ['#ffbe2e', '#ffe08a', '#fff6d6', '#ffffff'],
    ['#f5d061', '#fbbf24', '#fef08a', '#ffffff'],
    ['#10b981', '#6ee7b7', '#ffe08a', '#ffffff'],
    ['#ffbe2e', '#fb923c', '#fde047', '#ffffff'],
  ]

  type Spark = {
    x: number
    y: number
    px: number
    py: number
    vx: number
    vy: number
    size: number
    color: string
    life: number
    maxLife: number
  }

  const sparks: Spark[] = []
  const bursts = w < 640 ? 5 : 7

  const spawnBurst = (cx: number, cy: number) => {
    const palette = palettes[Math.floor(Math.random() * palettes.length)]
    const count = w < 640 ? 65 : 95
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.15
      const speed = 2.2 + Math.random() * 6.8
      sparks.push({
        x: cx,
        y: cy,
        px: cx,
        py: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.8 + Math.random() * 2.4,
        color: palette[Math.floor(Math.random() * palette.length)],
        life: 0,
        maxLife: 1100 + Math.random() * 900,
      })
    }
  }

  for (let b = 0; b < bursts; b++) {
    const delay = b * 420
    setTimeout(() => {
      if (!canvas.isConnected) return
      const cx = w * (0.18 + Math.random() * 0.64)
      const cy = h * (0.16 + Math.random() * 0.36)
      spawnBurst(cx, cy)
    }, delay)
  }

  let last = performance.now()
  const start = last

  const frame = (now: number) => {
    const dt = Math.min(now - last, 40)
    last = now
    const elapsed = now - start

    g.clearRect(0, 0, w, h)

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.life += dt
      if (s.life >= s.maxLife) {
        sparks.splice(i, 1)
        continue
      }
      s.px = s.x
      s.py = s.y
      s.vy += 0.085
      s.vx *= 0.975
      s.vy *= 0.975
      s.x += s.vx
      s.y += s.vy

      const alpha = Math.max(0, 1 - s.life / s.maxLife)
      g.save()
      g.globalAlpha = alpha
      g.strokeStyle = s.color
      g.lineWidth = s.size
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(s.px, s.py)
      g.lineTo(s.x, s.y)
      g.stroke()

      if (alpha > 0.45 && Math.random() > 0.65) {
        g.fillStyle = '#ffffff'
        g.beginPath()
        g.arc(s.x, s.y, s.size * 0.9, 0, Math.PI * 2)
        g.fill()
      }
      g.restore()
    }

    if (elapsed < durationMs || sparks.length > 0) {
      requestAnimationFrame(frame)
    } else {
      canvas.remove()
    }
  }

  requestAnimationFrame(frame)
}
