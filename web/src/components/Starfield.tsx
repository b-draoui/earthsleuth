import { useEffect, useRef } from 'react'

export default function Starfield({ density = 1, className = '' }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    let raf = 0
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

    const stars = Array.from({ length: Math.round(260 * density) }, () => ({
      x: rand(),
      y: rand(),
      r: rand() ** 3 * 1.4 + 0.2,
      a: rand() * 0.6 + 0.15,
      t: rand() * Math.PI * 2,
      depth: rand() * 0.8 + 0.2,
      warm: rand() > 0.85,
    }))
    const dust = Array.from({ length: Math.round(70 * density) }, () => ({
      x: rand(),
      y: rand(),
      r: rand() * 1.8 + 0.6,
      vx: (rand() - 0.5) * 0.00006,
      vy: -(rand() * 0.00008 + 0.00002),
      a: rand() * 0.25 + 0.05,
    }))

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }

    const draw = (time: number) => {
      pointer.x += (pointer.tx - pointer.x) * 0.04
      pointer.y += (pointer.ty - pointer.y) * 0.04
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        const tw = reduced ? 1 : 0.65 + 0.35 * Math.sin(time * 0.0012 * s.depth + s.t)
        const x = s.x * w - pointer.x * 14 * s.depth
        const y = s.y * h - pointer.y * 10 * s.depth
        ctx.globalAlpha = s.a * tw
        ctx.fillStyle = s.warm ? '#ffe2b8' : '#dbe9ff'
        ctx.beginPath()
        ctx.arc(x, y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const d of dust) {
        if (!reduced) {
          d.x += d.vx
          d.y += d.vy
          if (d.y < -0.02) d.y = 1.02
          if (d.x < -0.02) d.x = 1.02
          if (d.x > 1.02) d.x = -0.02
        }
        const x = d.x * w - pointer.x * 30
        const y = d.y * h - pointer.y * 20
        const g = ctx.createRadialGradient(x, y, 0, x, y, d.r * 4)
        g.addColorStop(0, 'rgba(236,232,225,0.75)')
        g.addColorStop(1, 'rgba(236,232,225,0)')
        ctx.globalAlpha = d.a
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, d.r * 4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (!reduced) raf = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [density])

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />
}
