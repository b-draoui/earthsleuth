import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

type Scroll = 'flyover' | 'answer' | number
interface Step {
  path: string
  caption: string
  ms: number
  scroll?: Scroll
}

const STEPS: Step[] = [
  { path: '/', caption: 'EarthSleuth: 24 years of climate across the Mediterranean and North Africa, tested for real signals.', ms: 6500 },
  { path: '/', caption: 'Fly in. Each square is about 100 km of land, coloured by how warm its year was.', ms: 15000, scroll: 'flyover' },
  { path: '/explore?v=t2m', caption: 'The lab: the 24-year trend of every land cell. A dot means it passed the significance test.', ms: 7000 },
  { path: '/explore?v=t2m&cell=36.5_10.5', caption: 'Pick a place: its five signals, its monthly record, the trend line and a plain verdict.', ms: 8500 },
  { path: '/explore?v=precip&mode=opposite', caption: 'Opposites: the same variable rising in some places and falling in others.', ms: 6500 },
  { path: '/investigate?case=f662d022d6ae', caption: 'Ask a question: the AI investigator follows the knowledge graph, runs the statistics, checks every number, then shows where.', ms: 14000, scroll: 'answer' },
  { path: '/understand', caption: 'Which signals are strongest, and which changes happen in the same places.', ms: 8000, scroll: 0.45 },
  { path: '/conclude', caption: 'The report: what changed, how sure we are, and what the data cannot say.', ms: 9000, scroll: 0.35 },
  { path: '/', caption: 'EarthSleuth. Can you see the signal?', ms: 4500 },
]
const TOTAL = STEPS.reduce((a, s) => a + s.ms, 0)

const Ctx = createContext<{ start: () => void; running: boolean }>({ start: () => {}, running: false })
export const useTour = () => useContext(Ctx)

function smoothScroll(to: number, ms: number, alive: () => boolean) {
  const from = window.scrollY
  const t0 = performance.now()
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
  const tick = (now: number) => {
    if (!alive()) return
    const t = Math.min(1, (now - t0) / ms)
    window.scrollTo({ top: from + (to - from) * ease(t), behavior: 'instant' })
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<number | null>(null)
  const run = useRef(0)
  const timers = useRef<number[]>([])

  const stop = useCallback(() => {
    run.current++
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setStep(null)
  }, [])

  const start = useCallback(() => {
    stop()
    setStep(0)
  }, [stop])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('tour') === '1') start()
  }, [])

  useEffect(() => {
    if (step === null) return
    const id = run.current
    const alive = () => run.current === id
    const s = STEPS[step]
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(() => alive() && fn(), ms))
    if (`${location.pathname}${location.search}` !== s.path) navigate(s.path)
    if (s.scroll === 'flyover') {
      later(() => {
        const el = document.getElementById('flyover')
        if (el) smoothScroll(el.offsetTop + el.offsetHeight - window.innerHeight, s.ms - 1500, alive)
      }, 600)
    } else if (s.scroll === 'answer') {
      later(() => {
        const el = document.querySelector('section[aria-label="Where"]') as HTMLElement | null
        const y = el ? el.getBoundingClientRect().top + window.scrollY - 90 : document.body.scrollHeight * 0.4
        smoothScroll(y, 3500, alive)
      }, 7000)
    } else if (typeof s.scroll === 'number') {
      const frac = s.scroll
      later(() => smoothScroll(document.body.scrollHeight * frac, s.ms - 2500, alive), 1500)
    }
    later(() => (step + 1 < STEPS.length ? setStep(step + 1) : stop()), s.ms)
  }, [step])

  useEffect(() => {
    if (step === null) return
    const onInput = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key === 'Tab') return
      stop()
    }
    window.addEventListener('wheel', onInput, { passive: true })
    window.addEventListener('touchstart', onInput, { passive: true })
    window.addEventListener('keydown', onInput)
    return () => {
      window.removeEventListener('wheel', onInput)
      window.removeEventListener('touchstart', onInput)
      window.removeEventListener('keydown', onInput)
    }
  }, [step, stop])

  const elapsed = step === null ? 0 : STEPS.slice(0, step).reduce((a, s) => a + s.ms, 0)

  return (
    <Ctx.Provider value={{ start, running: step !== null }}>
      {children}
      <AnimatePresence>
        {step !== null && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="glass fixed inset-x-3 bottom-4 z-[90] mx-auto max-w-2xl overflow-hidden rounded-2xl md:bottom-6"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-4 px-5 py-3.5">
              <span className="num shrink-0 text-[10px] tracking-[0.2em] text-accent uppercase">
                Tour {step + 1}/{STEPS.length}
              </span>
              <AnimatePresence mode="wait">
                <motion.p
                  key={step}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35 }}
                  className="min-w-0 flex-1 text-sm leading-snug text-ink"
                >
                  {STEPS[step].caption}
                </motion.p>
              </AnimatePresence>
              <button onClick={stop} className="shrink-0 rounded-[3px] border border-line px-3 py-1 text-xs text-muted hover:text-ink" aria-label="Stop the tour">
                Stop ✕
              </button>
            </div>
            <div className="h-[2px] bg-white/5">
              <motion.div
                key={step}
                className="h-full bg-accent"
                initial={{ width: `${(elapsed / TOTAL) * 100}%` }}
                animate={{ width: `${((elapsed + STEPS[step].ms) / TOTAL) * 100}%` }}
                transition={{ duration: STEPS[step].ms / 1000, ease: 'linear' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}

export function TourButton({ className = '' }: { className?: string }) {
  const { start, running } = useTour()
  return (
    <button onClick={start} disabled={running} className={`inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink disabled:opacity-40 ${className}`}>
      <span aria-hidden className="grid size-6 place-items-center rounded-full border border-line text-[9px]">▶</span>
      Watch the 80-second tour
    </button>
  )
}
