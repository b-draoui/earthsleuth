import { useCallback } from 'react'
import { Link } from 'react-router'
import { SCALES, SCALE_OF } from '../../lib/colors.ts'
import { sigDirection, useCells } from '../../lib/cells.ts'
import { nearestCity } from '../../lib/cities.ts'
import { latLon, pValue, signed } from '../../lib/format.ts'
import type { CellsMatrix, Summary, SummaryVariable } from '../../lib/types.ts'
import { VARS } from '../../lib/variables.ts'
import MiniMap, { divergingColor } from '../MiniMap.tsx'
import VarIcon from '../VarIcon.tsx'

const QUIET = '#222325'
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function headline(v: SummaryVariable): string {
  const id = VARS[v.variable]
  const { n, sig_up: up, sig_down: down } = v.cells
  if (up + down === 0) return 'No clear local change'
  const main = `${cap(up >= down ? id.up : id.down)} in ${Math.max(up, down)} of ${n} cells`
  if (!v.opposite) return main
  if (Math.max(up, down) >= 3 * Math.max(Math.min(up, down), 1))
    return up >= down ? `${main}; ${id.down} in ${v.opposite.down[0]}` : `${main}; ${id.up} in ${v.opposite.up[0]}`
  return `Split: ${id.up} in ${v.opposite.up[0]}, ${id.down} in ${v.opposite.down[0]}`
}

function tip(m: CellsMatrix, v: SummaryVariable['variable']) {
  return (i: number) => {
    const c = m.cells[i]
    const city = nearestCity(c.lat, c.lon)
    const x = m.variables[v]
    return (
      <>
        <p className="num text-faint">
          {city && <span className="font-sans text-ink">{city.name} area · </span>}
          {latLon(c.lat, c.lon)}
        </p>
        <p className="num mt-0.5 text-ink">
          {signed(x.slope[i])} {VARS[v].perDecade(x.unit)} <span className={x.sig[i] ? 'text-accent' : 'text-faint'}>{x.sig[i] ? '● real' : '○ chance?'}</span>
        </p>
      </>
    )
  }
}

function ChangeCard({ v, m, sentence, big }: { v: SummaryVariable; m: CellsMatrix; sentence: string; big?: boolean }) {
  const id = VARS[v.variable]
  const x = m.variables[v.variable]
  const scale = SCALES[SCALE_OF[v.variable]]
  const color = useCallback((i: number) => (x.sig[i] ? divergingColor(scale, x.slope[i], x.slope_max) : QUIET), [x, scale])
  const opacity = useCallback((i: number) => (x.sig[i] ? 0.95 : 0.55), [x])
  const r = v.regional
  return (
    <article className={`glass flex flex-col overflow-hidden rounded-3xl ${big ? 'sm:col-span-2' : ''}`}>
      <div className={big ? 'grid md:grid-cols-[1.5fr_1fr]' : ''}>
        <Link to={`/explore?v=${v.variable}`} aria-label={`Open ${id.short} in the lab`} className="block bg-abyss/60">
          <MiniMap m={m} color={color} opacity={opacity} tooltip={tip(m, v.variable)} cities={big} label={`${id.short}: significant trends by cell`} />
        </Link>
        <div className="flex flex-col p-5 md:p-6">
          <p className="flex items-center gap-2 text-sm" style={{ color: id.color }}>
            <VarIcon id={v.variable} size={16} /> {id.short}
          </p>
          <h3 className={`mt-2 font-display font-medium ${big ? 'text-2xl' : 'text-lg'} leading-snug`}>{headline(v)}</h3>
          <p className="num mt-3 text-sm text-muted">
            Whole region <strong className="text-ink">{signed(r.slope_per_decade)}</strong> {id.perDecade(v.unit)} ·{' '}
            <span className={r.significant ? 'text-accent' : 'text-faint'}>{r.significant ? `significant, ${pValue(r.p)}` : `could be chance, ${pValue(r.p)}`}</span>
          </p>
          <p className="mt-3 text-xs leading-relaxed text-faint">{sentence}</p>
        </div>
      </div>
    </article>
  )
}

export function ChangeMaps({ s, sentence }: { s: Summary; sentence: (v: SummaryVariable) => string }) {
  const { data: m } = useCells()
  if (!m) return <div className="skeleton h-96 rounded-3xl" />
  const order = [...s.variables].sort((a, b) => (a.variable === 't2m' ? -1 : b.variable === 't2m' ? 1 : 0))
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {order.map((v, i) => (
        <ChangeCard key={v.variable} v={v} m={m} sentence={sentence(v)} big={i === 0} />
      ))}
      <p className="text-xs leading-relaxed text-faint sm:col-span-2">
        Coloured cells passed the test (Mann–Kendall, false discovery rate 10%); dark cells could be chance. Hover a cell
        for its value, click a map to open it in the lab.
      </p>
    </div>
  )
}

export function TogetherMap({ s }: { s: Summary }) {
  const { data: m } = useCells()
  const color = useCallback(
    (i: number) => {
      if (!m) return null
      const a = sigDirection(m, 't2m', i) > 0
      const b = sigDirection(m, 'soil_moisture', i) < 0
      return a && b ? '#e7c48f' : a || b ? '#5a4a33' : QUIET
    },
    [m],
  )
  if (!m) return <div className="skeleton h-72 rounded-3xl" />
  return (
    <figure className="glass overflow-hidden rounded-3xl">
      <MiniMap m={m} color={color} cities label="Cells where the air warmed and the soil dried, both significantly" />
      <figcaption className="flex flex-wrap gap-x-5 gap-y-2 px-5 py-4 text-xs text-muted">
        <span className="num flex items-center gap-2">
          <span className="size-3 rounded-sm bg-[#e7c48f]" /> warming and drying soils: {s.warming_drying.n_cells} cells
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-[#5a4a33]" /> only one of the two
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-[#222325]" /> neither, or could be chance
        </span>
      </figcaption>
    </figure>
  )
}
