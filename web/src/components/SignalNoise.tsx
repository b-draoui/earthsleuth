import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { api } from '../lib/api.ts'
import { pValue, plain, signed } from '../lib/format.ts'
import { useFetch } from '../lib/useFetch.ts'
import { VARS } from '../lib/variables.ts'

const CELL = '36.5_10.5' // near Tunis
const W = 760
const H = 300
const PAD = { l: 44, r: 16, t: 20, b: 30 }

const STEPS = [
  {
    title: 'What the sensors record',
    text: 'Every summer is hot and every winter is cold. That swing is tens of times bigger than any climate trend, so in raw data the trend is buried.',
  },
  {
    title: 'Remove the seasons',
    text: 'Subtract from each month the average of that calendar month over 2001–2024. What is left is the anomaly: how unusual each month was.',
  },
  {
    title: 'Find the line, then test it',
    text: 'A Theil–Sen line gives the trend; a single extreme year barely moves it. A Mann–Kendall test then gives p: how often a trend this strong would appear by chance if nothing were changing.',
  },
]

function pathOf(values: (number | null)[], y: (v: number) => number, x: (i: number) => number): string {
  let d = ''
  let last = 0
  values.forEach((v, i) => {
    const val = v ?? last
    last = val
    d += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(val).toFixed(1)}`
  })
  return d
}

/**
 * Doc 1, Reason 3, as an interactive figure: the same monthly series seen raw, without seasons,
 * then with its trend and test. Real numbers from the API (one cell near Tunis).
 */
export default function SignalNoise() {
  const [step, setStep] = useState(0)
  const { data, error } = useFetch(`series:t2m:${CELL}`, () => api.series('t2m', CELL))

  const fig = useMemo(() => {
    if (!data) return null
    const n = data.value.length
    const x = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r)
    const vals = data.value.filter((v): v is number => v !== null)
    const anoms = data.anomaly.filter((v): v is number => v !== null)
    const rawMin = Math.min(...vals)
    const rawMax = Math.max(...vals)
    const aMax = Math.max(...anoms.map(Math.abs))
    const domain = step === 0 ? [rawMin, rawMax] : [-aMax, aMax]
    const y = (v: number) => H - PAD.b - ((v - domain[0]) / (domain[1] - domain[0])) * (H - PAD.t - PAD.b)
    const series = step === 0 ? data.value : data.anomaly
    const cycle = data.seasonal_cycle.filter((v): v is number => v !== null)
    return {
      line: pathOf(series, y, x),
      trend: pathOf(data.trend, y, x),
      band:
        pathOf(data.band_hi, y, x) +
        ' ' +
        pathOf([...data.band_lo].reverse(), y, (i) => x(n - 1 - i)).replace('M', 'L') +
        ' Z',
      zero: y(0),
      ticks: [domain[0], (domain[0] + domain[1]) / 2, domain[1]].map((v) => ({ v, y: y(v) })),
      years: [2001, 2006, 2011, 2016, 2021, 2024].map((yr) => ({ yr, x: x((yr - 2001) * 12) })),
      swing: Math.max(...cycle) - Math.min(...cycle),
    }
  }, [data, step])

  const s = data?.stats
  const unit = data?.unit ?? '°C'

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
      <div className="glass relative overflow-hidden rounded-3xl p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between text-xs text-faint">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: VARS.t2m.color }} />
            Air temperature, one 1° cell near Tunis · monthly, 2001–2024
          </span>
          <span className="num">{step === 0 ? `${unit}` : `${unit} vs. usual`}</span>
        </div>
        {error && <p className="p-10 text-center text-sm text-rose-300">Could not load the series: {error.message}</p>}
        {!fig && !error && <div className="skeleton h-[260px] rounded-xl" />}
        {fig && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={STEPS[step].title}>
            {fig.ticks.map((t, i) => (
              <g key={i}>
                <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#24324f" strokeDasharray="2 4" />
                <text x={PAD.l - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill="#5d6a83" className="num">
                  {plain(t.v, 1)}
                </text>
              </g>
            ))}
            {fig.years.map((t) => (
              <text key={t.yr} x={t.x} y={H - 8} textAnchor="middle" fontSize="11" fill="#5d6a83" className="num">
                {t.yr}
              </text>
            ))}
            <AnimatePresence>
              {step === 2 && (
                <motion.path
                  key="band"
                  d={fig.band}
                  fill="#ff8a65"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.18 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                />
              )}
            </AnimatePresence>
            <motion.path
              d={fig.line}
              fill="none"
              stroke="#ff8a65"
              strokeWidth={step === 0 ? 1.4 : 1.1}
              strokeOpacity={step === 2 ? 0.45 : 0.9}
              initial={false}
              animate={{ d: fig.line }}
              transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
            />
            <AnimatePresence>
              {step === 2 && (
                <motion.path
                  key="trend"
                  d={fig.trend}
                  fill="none"
                  stroke="#ffe2b8"
                  strokeWidth={2.5}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.3 }}
                  style={{ filter: 'drop-shadow(0 0 6px rgba(255,180,120,.8))' }}
                />
              )}
            </AnimatePresence>
          </svg>
        )}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat label="Seasonal swing" value={fig ? `${plain(fig.swing, 1)} ${unit}` : '…'} on={step === 0} />
          <Stat label="Trend" value={s ? `${signed(s.slope_dec)} ${unit}/decade` : '…'} on={step === 2} />
          <Stat label="Mann–Kendall test" value={s ? pValue(s.p) : '…'} on={step === 2} />
        </div>
      </div>

      <div>
        <ol className="space-y-3">
          {STEPS.map((st, i) => (
            <li key={st.title}>
              <button
                onClick={() => setStep(i)}
                aria-pressed={step === i}
                className={`group w-full rounded-2xl border p-5 text-left transition-all duration-500 ${
                  step === i ? 'border-accent/50 bg-accent/[0.07] shadow-[0_0_40px_-18px_var(--color-accent)]' : 'border-line/70 hover:border-line hover:bg-white/[0.02]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`num grid size-7 place-items-center rounded-full border text-xs ${step === i ? 'border-accent text-accent' : 'border-line text-faint'}`}>
                    {i + 1}
                  </span>
                  <span className="font-display text-lg font-medium">{st.title}</span>
                </span>
                <AnimatePresence initial={false}>
                  {step === i && (
                    <motion.p
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-10 text-sm leading-relaxed text-muted"
                    >
                      <span className="block pt-2">{st.text}</span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </button>
            </li>
          ))}
        </ol>
        {s && step === 2 && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 pl-1 text-sm leading-relaxed text-muted">
            Verdict for this cell:{' '}
            <strong className="text-ink">{s.significant ? 'a real signal' : 'could still be noise'}</strong>.{' '}
            {s.significant
              ? `Tested together with every other land cell, it stays significant (q = ${plain(s.q, 3)}).`
              : `Tested together with every other land cell, it does not pass the bar (q = ${plain(s.q, 3)}).`}
          </motion.p>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 transition-colors duration-500 ${on ? 'border-v-t2m/40 bg-v-t2m/[0.06]' : 'border-line/60'}`}>
      <p className="eyebrow !text-[9px]">{label}</p>
      <p className={`num mt-1 text-sm font-medium md:text-base ${on ? 'text-ink' : 'text-muted'}`}>{value}</p>
    </div>
  )
}
