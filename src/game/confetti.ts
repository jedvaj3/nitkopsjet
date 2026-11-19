/** Lightweight canvas confetti burst, no dependencies. */
export function fireConfetti(durationMs = 3200) {
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

  const colors = ['#ffc83d', '#ffe08a', '#22e5ff', '#a78bfa', '#ff5fa2', '#ffffff']
  const count = w < 640 ? 140 : 240
  const parts = Array.from({ length: count }, (_, i) => {
    const fromLeft = i % 2 === 0
    return {
      x: fromLeft ? -10 : w + 10,
      y: h * (0.55 + Math.random() * 0.3),
      vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9),
      vy: -(9 + Math.random() * 11),
      size: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.3 ? 'rect' : 'circle',
    }
  })

  const start = performance.now()
  const frame = (now: number) => {
    const elapsed = now - start
    g.clearRect(0, 0, w, h)
    const fade = Math.max(0, 1 - Math.max(0, elapsed - durationMs + 800) / 800)
    for (const p of parts) {
      p.vy += 0.28
      p.vx *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      g.save()
      g.globalAlpha = fade
      g.translate(p.x, p.y)
      g.rotate(p.rot)
      g.fillStyle = p.color
      if (p.shape === 'rect') g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      else {
        g.beginPath()
        g.arc(0, 0, p.size / 3, 0, Math.PI * 2)
        g.fill()
      }
      g.restore()
    }
    if (elapsed < durationMs) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
