/**
 * Hear the signal: a monthly series played as notes (Web Audio, no files).
 * Each month is one short note: higher pitch = further above its usual value.
 * Under the notes, a low hum follows the trend line on the same pitch scale,
 * so a real trend sounds like a slow drift and noise sounds like noise.
 */
const STEP = 0.034 // seconds per month: 288 months ≈ 10 s
const PENTA = [0, 3, 5, 7, 10] // minor pentatonic, in semitones

function robustMax(xs: (number | null)[]): number {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x)).map(Math.abs).sort((a, b) => a - b)
  return v.length ? v[Math.floor(0.95 * (v.length - 1))] || 1 : 1
}

/** -1..1 -> a note of the pentatonic scale over two octaves around A3. */
function noteFreq(norm: number): number {
  const steps = Math.round(norm * 5) // -5..5 scale degrees
  const octave = Math.floor(steps / 5)
  const degree = ((steps % 5) + 5) % 5
  return 220 * 2 ** ((octave * 12 + PENTA[degree]) / 12)
}

export function playSeries(
  anomaly: (number | null)[],
  trend: (number | null)[],
  onStep: (i: number) => void,
  onEnd: () => void,
): () => void {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  const max = robustMax(anomaly)
  const out = ctx.createDynamicsCompressor()
  const master = ctx.createGain()
  master.gain.value = 0.55
  out.connect(master).connect(ctx.destination)

  const t0 = ctx.currentTime + 0.15
  anomaly.forEach((v, i) => {
    if (v === null) return
    const norm = Math.max(-1, Math.min(1, v / max))
    const t = t0 + i * STEP
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = noteFreq(norm)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.16, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
    osc.connect(g).connect(out)
    osc.start(t)
    osc.stop(t + 0.18)
  })

  // the trend hum, one octave lower, gliding continuously
  const hum = ctx.createOscillator()
  const hg = ctx.createGain()
  hum.type = 'sine'
  const first = trend.find((x) => x !== null) ?? 0
  hum.frequency.setValueAtTime(110 * 2 ** ((Math.max(-1, Math.min(1, first / max)) * 12) / 12), t0)
  trend.forEach((v, i) => {
    if (v === null) return
    const norm = Math.max(-1, Math.min(1, v / max))
    hum.frequency.linearRampToValueAtTime(110 * 2 ** ((norm * 12) / 12), t0 + i * STEP)
  })
  const end = t0 + anomaly.length * STEP
  hg.gain.setValueAtTime(0, t0)
  hg.gain.linearRampToValueAtTime(0.22, t0 + 0.5)
  hg.gain.setValueAtTime(0.22, end - 0.4)
  hg.gain.linearRampToValueAtTime(0, end)
  hum.connect(hg).connect(out)
  hum.start(t0)
  hum.stop(end + 0.05)

  let last = -1
  let raf = 0
  let stopped = false
  const tick = () => {
    if (stopped) return
    const i = Math.floor((ctx.currentTime - t0) / STEP)
    if (i >= anomaly.length) {
      stop()
      onEnd()
      return
    }
    if (i >= 0 && i !== last) {
      last = i
      onStep(i)
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  function stop() {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(raf)
    ctx.close().catch(() => {})
  }
  return stop
}
