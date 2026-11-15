import { motion } from 'motion/react'
import { useCallback, useMemo } from 'react'
import { Link } from 'react-router'
import { SCALES, SCALE_OF } from '../../lib/colors.ts'
import { inBox, sigDirection, useCells } from '../../lib/cells.ts'
import { nearestCity } from '../../lib/cities.ts'
import { latLon, pct, signed } from '../../lib/format.ts'
import type { Region, VariableId, VariableResult } from '../../lib/types.ts'
import { VARS } from '../../lib/variables.ts'
import MiniMap, { STUDY_VIEW } from '../MiniMap.tsx'

const MATCH = '#c9b8ff'
const PARTIAL = '#4b4470'
const QUIET = '#1a2335'

interface Condition {
  v: VariableId
  dir: 1 | -1
}

/**
 * "Where?" answered on a map. Built only from the trend results the investigator used:
 * - one variable: cells where it rose or fell significantly;
 * - several with a significant regional direction: cells where all of them did so, together.
 */
export default function AnswerMap({ results, regions }: { results: VariableResult[]; regions: Region[] }) {
  const { data: m } = useCells()

  const spec = useMemo(() => {
    const byVar = new Map<VariableId, VariableResult>()
    for (const r of results) if (!byVar.has(r.variable)) byVar.set(r.variable, r)
    const list = [...byVar.values()]
    if (!list.length) return null
    const regionId = list[0].region
    const region = regions.find((r) => r.id === regionId)
    const bbox = regionId !== 'mediterranean_north_africa' ? (list[0].bbox ?? region?.bbox ?? null) : null
    const directional: Condition[] = list
      .filter((r) => r.regional.significant && r.regional.slope_per_decade !== 0)
      .map((r) => ({ v: r.variable, dir: r.regional.slope_per_decade > 0 ? 1 : -1 }))
    const left = list.filter((r) => !directional.some((d) => d.v === r.variable)).map((r) => r.variable)
    if (directional.length >= 2) return { kind: 'together' as const, conds: directional, left, bbox, regionLabel: region?.label }
    const single = directional[0]?.v ?? list[0].variable
    return { kind: 'single' as const, v: single, left: list.map((r) => r.variable).filter((v) => v !== single), bbox, regionLabel: region?.label }
  }, [results, regions])

  const view: [number, number, number, number] = spec?.bbox
    ? [Math.max(spec.bbox[0] - 2.5, STUDY_VIEW[0]), Math.min(spec.bbox[1] + 2.5, STUDY_VIEW[1]), Math.max(spec.bbox[2] - 2, STUDY_VIEW[2]), Math.min(spec.bbox[3] + 2, STUDY_VIEW[3])]
    : STUDY_VIEW

  const matchCount = useCallback(
    (i: number) => (spec?.kind === 'together' && m ? spec.conds.filter((c) => sigDirection(m, c.v, i) === c.dir).length : 0),
    [m, spec],
  )

  const color = useCallback(
    (i: number) => {
      if (!m || !spec) return null
      if (spec.kind === 'single') {
        const d = sigDirection(m, spec.v, i)
        const sc = SCALES[SCALE_OF[spec.v]]
        return d > 0 ? sc[5] : d < 0 ? sc[1] : QUIET
      }
      const k = matchCount(i)
      return k === spec.conds.length ? MATCH : k > 0 ? PARTIAL : QUIET
    },
    [m, spec, matchCount],
  )

  const opacity = useCallback((i: number) => (m && spec?.bbox && !inBox(m.cells[i], spec.bbox) ? 0.35 : 0.95), [m, spec])

  if (!spec) return null
  if (!m) return <div className="skeleton mt-6 h-72 rounded-3xl" />

  const inside = m.cells.map((_, i) => i).filter((i) => inBox(m.cells[i], spec.bbox))
  const n = inside.length
  const where = spec.regionLabel && spec.bbox ? `in ${spec.regionLabel}` : 'across the study area'

  let title: string
  let legend: { color: string; text: string }[]
  if (spec.kind === 'single') {
    const up = inside.filter((i) => sigDirection(m, spec.v, i) > 0).length
    const down = inside.filter((i) => sigDirection(m, spec.v, i) < 0).length
    const sc = SCALES[SCALE_OF[spec.v]]
    title = `Where ${VARS[spec.v].short.toLowerCase()} changed for real, ${where}`
    legend = [
      { color: sc[1], text: `${VARS[spec.v].down}: ${down} cells (${pct((100 * down) / n)})` },
      { color: sc[5], text: `${VARS[spec.v].up}: ${up} cells (${pct((100 * up) / n)})` },
      { color: QUIET, text: 'could be chance' },
    ]
  } else {
    const words = spec.conds.map((c) => (c.dir > 0 ? VARS[c.v].up : VARS[c.v].down))
    const all = inside.filter((i) => matchCount(i) === spec.conds.length).length
    const some = inside.filter((i) => {
      const k = matchCount(i)
      return k > 0 && k < spec.conds.length
    }).length
    title = `Where ${joinWords(words)} happen together, ${where}`
    legend = [
      { color: MATCH, text: `${spec.conds.length === 2 ? 'both' : `all ${spec.conds.length}`} at once: ${all} cells (${pct((100 * all) / n)})` },
      { color: PARTIAL, text: `only some: ${some} cells` },
      { color: QUIET, text: 'none, or could be chance' },
    ]
  }

  const tooltip = (i: number) => {
    const c = m.cells[i]
    const city = nearestCity(c.lat, c.lon)
    const vars: VariableId[] = spec.kind === 'single' ? [spec.v] : spec.conds.map((x) => x.v)
    return (
      <>
        <p className="num text-faint">
          {city && <span className="font-sans text-ink">{city.name} area · </span>}
          {latLon(c.lat, c.lon)}
        </p>
        {vars.map((v) => {
          const s = m.variables[v].slope[i]
          return (
            <p key={v} className="num mt-0.5 text-ink">
              {VARS[v].short}: {signed(s)} {VARS[v].perDecade(m.variables[v].unit)}{' '}
              <span className={m.variables[v].sig[i] ? 'text-accent' : 'text-faint'}>{m.variables[v].sig[i] ? '● real' : '○ chance?'}</span>
            </p>
          )
        })}
      </>
    )
  }

  const firstVar = spec.kind === 'single' ? spec.v : spec.conds[0].v
  const regionId = results[0]?.region
  const exploreLink = `/explore?v=${firstVar}${regionId && regionId !== 'mediterranean_north_africa' ? `&region=${regionId}` : ''}&mode=${spec.kind === 'single' ? 'opposite' : 'trend'}`

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="glass mt-6 overflow-hidden rounded-3xl"
      aria-label="Where"
    >
      <div className="px-6 pt-6 md:px-8">
        <p className="eyebrow">Where</p>
        <h2 className="mt-2 font-display text-xl leading-snug font-medium md:text-2xl">{title}</h2>
      </div>
      <MiniMap m={m} color={color} opacity={opacity} view={view} cities box={spec.bbox} tooltip={tooltip} className="mt-4" label={title} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4 text-xs text-muted md:px-8">
        {legend.map((l) => (
          <span key={l.text} className="num flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ background: l.color }} />
            {l.text}
          </span>
        ))}
        <Link to={exploreLink} className="ml-auto text-faint transition-colors hover:text-ink">
          Open in the lab →
        </Link>
      </div>
      <p className="border-t border-line/60 px-6 py-3 text-[11px] leading-relaxed text-faint md:px-8">
        A cell counts when its own trend passes the test (Mann–Kendall, false discovery rate 10%).
        {spec.left.length > 0 &&
          ` Not mapped: ${spec.left.map((v) => VARS[v].short.toLowerCase()).join(', ')}, no significant direction over the region.`}{' '}
        Showing where, not why.
      </p>
    </motion.section>
  )
}

function joinWords(w: string[]): string {
  if (w.length <= 1) return w.join('')
  return `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`
}
