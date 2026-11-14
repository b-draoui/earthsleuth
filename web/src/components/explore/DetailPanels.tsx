import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../lib/api.ts'
import { latLon, pValue, pct, plain, signed } from '../../lib/format.ts'
import type { Region, VariableId } from '../../lib/types.ts'
import { useFetch } from '../../lib/useFetch.ts'
import { VARS, directionWord } from '../../lib/variables.ts'
import { SCALES, SCALE_OF } from '../../lib/colors.ts'
import { AFTER, AFTER_LABEL, BEFORE, BEFORE_LABEL, windowMean } from '../../lib/periods.ts'
import SeriesChart from '../SeriesChart.tsx'
import SignalGauge from '../SignalGauge.tsx'
import { SimulatedNote } from '../SimulatedBadge.tsx'
import VarIcon from '../VarIcon.tsx'

function Shell({ title, kicker, onClose, children }: { title: string; kicker: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.aside
      initial={{ x: 48, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 48, opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="glass scroll-thin pointer-events-auto flex max-h-full w-full flex-col overflow-y-auto rounded-3xl md:w-[420px]"
      aria-label={title}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line/60 bg-panel/80 px-6 py-4 backdrop-blur">
        <div>
          <p className="eyebrow">{kicker}</p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted transition-colors hover:bg-white/5 hover:text-ink">
          ✕
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </motion.aside>
  )
}

function Verdict({ variable, slope, lo, hi, unit, significant, q, p }: {
  variable: VariableId
  slope: number
  lo: number
  hi: number
  unit: string
  significant: boolean
  q?: number
  p: number
}) {
  const id = VARS[variable]
  return (
    <div>
      <div className="flex items-end gap-3">
        <p className="num font-display text-4xl font-semibold" style={{ color: significant ? id.color : 'var(--color-muted)' }}>
          {signed(slope)}
        </p>
        <p className="pb-1.5 text-sm text-muted">{id.perDecade(unit)}</p>
      </div>
      <p className="num mt-1 text-xs text-faint">
        95% range {signed(lo)} to {signed(hi)} · {pValue(p)}
        {q !== undefined && ` · ${pValue(q, 'q')}`}
      </p>
      <div
        className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
          significant ? 'border-accent/40 bg-accent/[0.07] text-ink' : 'border-line bg-white/[0.02] text-muted'
        }`}
      >
        {significant ? (
          <>
            <strong>Real signal.</strong> {cap(directionWord(variable, slope))}: a trend this steady would be very unlikely if
            nothing were changing.
          </>
        ) : (
          <>
            <strong className="text-ink">Could be chance.</strong> The line tilts {slope > 0 ? 'up' : 'down'}, but random
            year-to-year swings could produce it. No conclusion here.
          </>
        )}
      </div>
      <div className="mt-5">
        <SignalGauge value={q ?? p} threshold={q !== undefined ? 0.1 : 0.05} label={q !== undefined ? 'q' : 'p'} />
      </div>
    </div>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const WINDOWS: [string, string, string][] = [
  ['2001-01', '2005-12', 'before'],
  ['2020-01', '2024-12', 'after'],
]

/** Compare mode: the two 5-year averages and their difference, clearly not a test. */
function BeforeAfter({ variable, before, after, unit }: { variable: VariableId; before: number | null; after: number | null; unit: string }) {
  if (before === null || after === null) return null
  const scale = SCALES[SCALE_OF[variable]]
  const tint = (v: number) => (Math.abs(v) < 1e-9 ? 'var(--color-muted)' : v > 0 ? scale[5] : scale[1])
  const change = after - before
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border border-sand/30 bg-sand/[0.05] p-4"
    >
      <p className="eyebrow !text-sand/80">Before / after · vs. the 2001–2024 average</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <div>
          <p className="num text-[11px] text-faint">{BEFORE_LABEL}</p>
          <p className="num font-display text-2xl font-semibold" style={{ color: tint(before) }}>
            {signed(before)}
          </p>
        </div>
        <span aria-hidden className="pb-1.5 text-faint">→</span>
        <div className="text-right">
          <p className="num text-[11px] text-faint">{AFTER_LABEL}</p>
          <p className="num font-display text-2xl font-semibold" style={{ color: tint(after) }}>
            {signed(after)}
          </p>
        </div>
      </div>
      <p className="num mt-2 text-sm text-muted">
        Change: <strong className="text-ink">{signed(change)} {unit}</strong> ({directionWord(variable, change)})
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        Two 5-year averages, highlighted on the chart. Their difference alone is not a test: whether the change is real is
        decided by the full-period trend below.
      </p>
    </motion.div>
  )
}

export function CellPanel({ variable, cellId, regions, onClose, compare = false }: { variable: VariableId; cellId: string; regions: Region[]; onClose: () => void; compare?: boolean }) {
  const [mode, setMode] = useState<'anomaly' | 'raw'>('anomaly')
  const { data, error } = useFetch(`series:${variable}:${cellId}`, () => api.series(variable, cellId))
  const id = VARS[variable]
  const names = data?.regions.map((r) => regions.find((x) => x.id === r)?.label ?? r) ?? []

  return (
    <Shell title={data ? latLon(data.lat, data.lon) : 'Loading…'} kicker={`One 1° cell${names.length ? ` · ${names.join(', ')}` : ''}`} onClose={onClose}>
      {error && <p className="text-sm text-rose-300">{error.message}</p>}
      {!data && !error && <div className="skeleton h-80 rounded-2xl" />}
      {data && (
        <>
          <p className="mb-4 flex items-center gap-2 text-sm" style={{ color: id.color }}>
            <VarIcon id={variable} size={16} /> {id.long}
          </p>
          {compare && (
            <>
              <BeforeAfter
                variable={variable}
                before={windowMean(data.time, data.anomaly, BEFORE)}
                after={windowMean(data.time, data.anomaly, AFTER)}
                unit={data.unit}
              />
              <p className="eyebrow mb-3">Full-period trend, 2001–2024 · the test</p>
            </>
          )}
          <Verdict
            variable={variable}
            slope={data.stats.slope_dec}
            lo={data.stats.ci_lo}
            hi={data.stats.ci_hi}
            unit={data.unit}
            significant={data.stats.significant}
            q={data.stats.q}
            p={data.stats.p}
          />
          <div className="mt-7 flex items-center justify-between">
            <p className="eyebrow">Monthly record</p>
            <div role="tablist" className="flex rounded-full border border-line p-0.5 text-xs">
              {(['anomaly', 'raw'] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-3 py-1 transition-colors ${mode === m ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {m === 'anomaly' ? 'Without seasons' : 'As measured'}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <SeriesChart time={data.time} value={data.value} anomaly={data.anomaly} lines={data} unit={data.unit} color={id.color} mode={mode} windows={compare ? WINDOWS : undefined} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            {mode === 'anomaly'
              ? 'Each month minus its usual value. Light line: Theil–Sen trend. Shaded fan: its 95% range.'
              : `Raw monthly values. The seasonal swing hides the trend; that is why it is computed without seasons.`}
          </p>
          <div className="mt-6 border-t border-line/60 pt-4 text-xs leading-relaxed text-faint">
            <p>
              {data.stats.n} months · Theil–Sen slope · Mann–Kendall test with Hamed–Rao correction · FDR 10% across all cells.
            </p>
            <SimulatedNote className="mt-2" />
          </div>
        </>
      )}
    </Shell>
  )
}

export function RegionPanel({ variable, region, onClose, compare = false }: { variable: VariableId; region: Region; onClose: () => void; compare?: boolean }) {
  const { data: stats } = useFetch(`regional:${variable}:${region.id}`, () => api.regional(variable, region.id))
  const { data: series } = useFetch(`rseries:${variable}:${region.id}`, () => api.regionalSeries(variable, region.id))
  const id = VARS[variable]

  return (
    <Shell title={region.label} kicker="Region · area-weighted average" onClose={onClose}>
      {!stats && <div className="skeleton h-80 rounded-2xl" />}
      {stats && (
        <>
          <p className="mb-4 flex items-center gap-2 text-sm" style={{ color: id.color }}>
            <VarIcon id={variable} size={16} /> {id.long}
          </p>
          {compare && series && (
            <>
              <BeforeAfter
                variable={variable}
                before={windowMean(series.time, series.anomaly, BEFORE)}
                after={windowMean(series.time, series.anomaly, AFTER)}
                unit={series.unit}
              />
              <p className="eyebrow mb-3">Full-period trend, 2001–2024 · the test</p>
            </>
          )}
          <Verdict
            variable={variable}
            slope={stats.regional.slope_per_decade}
            lo={stats.regional.ci95[0]}
            hi={stats.regional.ci95[1]}
            unit={stats.unit}
            significant={stats.regional.significant}
            p={stats.regional.p}
          />
          <div className="mt-7">
            <p className="eyebrow">Local trends inside the region</p>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white/5">
              <div style={{ width: `${(stats.cells.sig_down / stats.cells.n) * 100}%`, background: SCALES[SCALE_OF[variable]][1] }} />
              <div className="flex-1" />
              <div style={{ width: `${(stats.cells.sig_up / stats.cells.n) * 100}%`, background: SCALES[SCALE_OF[variable]][5] }} />
            </div>
            <p className="num mt-2 flex justify-between text-xs text-muted">
              <span>{stats.cells.sig_down} cells down</span>
              <span>{pct(stats.cells.pct_sig_area)} of the area significant</span>
              <span>{stats.cells.sig_up} up</span>
            </p>
          </div>
          <div className="mt-7">
            <p className="eyebrow">Regional record, without seasons</p>
            {series ? (
              <div className="mt-3">
                <SeriesChart time={series.time} value={series.value} anomaly={series.anomaly} lines={series} unit={series.unit} color={id.color} mode="anomaly" height={190} windows={compare ? WINDOWS : undefined} />
              </div>
            ) : (
              <div className="skeleton mt-3 h-[190px] rounded-xl" />
            )}
          </div>
          <Link
            to={`/investigate?q=${encodeURIComponent(`How is ${id.short.toLowerCase()} changing in ${region.label}?`)}`}
            className="mt-6 flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            Ask the investigator about {region.label} <span aria-hidden>→</span>
          </Link>
          <div className="mt-6 border-t border-line/60 pt-4 text-xs leading-relaxed text-faint">
            <p className="num">
              {stats.cells.n} cells · {stats.datasets.join(', ')} · method: {stats.method}
            </p>
            <p className="num mt-1">
              Average {plain(stats.regional.slope_per_decade)} {stats.unit} per decade across the box shown on the map.
            </p>
          </div>
        </>
      )}
    </Shell>
  )
}
