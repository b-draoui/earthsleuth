import type { ExpressionSpecification } from 'maplibre-gl'
import { motion } from 'motion/react'
import { Suspense, lazy, useMemo, useState } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import { Link } from 'react-router'
import Footer from '../components/Footer.tsx'
import PageTransition from '../components/PageTransition.tsx'
import Reveal, { Chapter } from '../components/Reveal.tsx'
import SimulatedBadge from '../components/SimulatedBadge.tsx'
import TopoLines from '../components/TopoLines.tsx'
import VarIcon from '../components/VarIcon.tsx'
import { api } from '../lib/api.ts'
import { CATEGORICAL, SCALES, SCALE_OF } from '../lib/colors.ts'
import { pct, pValue, signed } from '../lib/format.ts'
import { regionStyle } from '../lib/map.ts'
import { VARIABLE_IDS, type ClusterSummary, type ClustersGeoJSON, type RankingRow } from '../lib/types.ts'
import { useFetch } from '../lib/useFetch.ts'
import { VARS } from '../lib/variables.ts'

const Connections = lazy(() => import('../components/understand/Connections.tsx'))

/** 04 · Understand: which signals are strongest, which changes travel together, how it all connects. */
export default function Understand() {
  const { data: ranking } = useFetch('ranking', api.ranking)
  const { data: clusters } = useFetch('clusters', api.clusters)
  const { data: graph } = useFetch('graph', api.graph)

  return (
    <PageTransition className="relative">
      <section className="relative overflow-hidden pt-32 pb-24">
        <TopoLines className="opacity-60" seed={3} />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mb-8 flex items-center gap-3">
            <p className="eyebrow">04 · Understand</p>
            <SimulatedBadge compact />
          </div>
          <Chapter n="A" kicker="Signal Radar" title={<>Which signals are <span className="text-gradient">strongest?</span></>} />
          <Reveal delay={0.1} className="mt-5 max-w-2xl text-muted">
            Share of the land where a variable has a significant local trend (after false-discovery control), split into
            places where it goes down and places where it goes up. Longer bars: more of the region is really changing.
          </Reveal>
          <div className="mt-12 space-y-3">
            {ranking
              ? ranking.map((r, i) => (
                  <Reveal key={r.variable} delay={i * 0.06}>
                    <RadarRow r={r} />
                  </Reveal>
                ))
              : Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
          </div>
        </div>
      </section>

      <section className="relative py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Chapter n="B" kicker="Patterns" title="Some changes travel together." />
          <Reveal delay={0.1} className="mt-5 max-w-2xl text-muted">
            Places are grouped by the shape of their five trends (k-means on standardised slopes). A group only says that
            these places changed in a similar way. It does not say why, and whether each trend is real is decided by the tests
            above.
          </Reveal>
          {clusters ? <Clusters data={clusters.meta.clusters} features={clusters} /> : <div className="skeleton mt-12 h-[460px] rounded-3xl" />}
        </div>
      </section>

      <section id="connections" className="relative scroll-mt-20 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Chapter n="C" kicker="Connections" title="From satellites to findings, everything is linked." />
          <Reveal delay={0.1} className="mt-5 max-w-2xl text-muted">
            The knowledge graph links each finding back to the variable, the dataset and the mission it comes from, so any
            claim can be traced to its source.
          </Reveal>
          <div className="mt-12">
            {graph ? (
              <Suspense fallback={<div className="skeleton h-[560px] rounded-3xl" />}>
                <Connections graph={graph} />
              </Suspense>
            ) : (
              <div className="skeleton h-[560px] rounded-3xl" />
            )}
          </div>
          <Reveal className="mt-16 text-center">
            <Link
              to="/conclude"
              className="cta inline-flex items-center gap-3 rounded-full bg-space/70 px-9 py-4 font-display text-sm font-semibold tracking-[0.22em] uppercase transition-transform hover:scale-[1.03]"
            >
              05 · Conclude <span aria-hidden>→</span>
            </Link>
          </Reveal>
        </div>
      </section>
      <Footer />
    </PageTransition>
  )
}

function RadarRow({ r }: { r: RankingRow }) {
  const id = VARS[r.variable]
  const scale = SCALES[SCALE_OF[r.variable]]
  const max = 100
  return (
    <Link
      to={`/explore?v=${r.variable}&mode=opposite`}
      className="group glass grid items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-500 hover:border-accent/40 md:grid-cols-[200px_minmax(0,1fr)_220px]"
    >
      <span className="flex items-center gap-3" style={{ color: id.color }}>
        <VarIcon id={r.variable} size={20} />
        <span className="font-display text-base font-medium text-ink">{id.short}</span>
      </span>
      <div>
        <div className="relative flex h-4 items-center">
          <span className="absolute left-1/2 h-6 w-px bg-line" />
          <div className="flex h-full w-1/2 justify-end">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${(r.pct_down / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-l-full"
              style={{ background: scale[1] }}
            />
          </div>
          <div className="flex h-full w-1/2">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${(r.pct_up / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-r-full"
              style={{ background: scale[5] }}
            />
          </div>
        </div>
        <p className="num mt-1.5 flex justify-between text-[11px] text-faint">
          <span>
            {pct(r.pct_down)} {id.down}
          </span>
          <span>
            {id.up} {pct(r.pct_up)}
          </span>
        </p>
      </div>
      <p className="num text-right text-xs text-muted">
        <span className="font-display text-2xl font-semibold text-ink">{pct(r.pct_total)}</span> of the land
        <span className="block text-faint">
          region {signed(r.regional.slope_per_decade)} {id.perDecade(r.unit)} · {r.regional.significant ? 'significant' : pValue(r.regional.p)}
        </span>
      </p>
    </Link>
  )
}

function Clusters({ data, features }: { data: ClusterSummary[]; features: ClustersGeoJSON }) {
  const [hover, setHover] = useState<number | null>(null)
  const style = useMemo(() => regionStyle(), [])
  const color = ['match', ['get', 'cluster'], ...data.flatMap((c) => [c.cluster, CATEGORICAL[c.cluster % CATEGORICAL.length]]), '#333'] as unknown as ExpressionSpecification
  const maxZ = Math.max(0.5, ...data.flatMap((c) => Object.values(c.signature).map((v) => Math.abs(v ?? 0))))
  const opacity = (hover === null ? 0.85 : ['case', ['==', ['get', 'cluster'], hover], 0.95, 0.12]) as ExpressionSpecification

  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="glass relative h-[460px] overflow-hidden rounded-3xl">
        <Map
          initialViewState={{ bounds: [[-11, 23.5], [41, 48.5]], fitBoundsOptions: { padding: 16 } }}
          mapStyle={style}
          dragRotate={false}
          scrollZoom={false}
          attributionControl={{ compact: true, customAttribution: 'Natural Earth' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <Source id="clusters" type="geojson" data={features}>
            <Layer id="clusters-fill" type="fill" beforeId="sea" paint={{ 'fill-color': color, 'fill-opacity': opacity, 'fill-opacity-transition': { duration: 300 } }} />
          </Source>
        </Map>
      </div>
      <ul className="space-y-3">
        {[...data]
          .sort((a, b) => b.n_cells - a.n_cells)
          .map((c) => (
            <li key={c.cluster}>
              <button
                onMouseEnter={() => setHover(c.cluster)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(c.cluster)}
                onBlur={() => setHover(null)}
                className={`glass w-full rounded-2xl p-4 text-left transition-all duration-300 ${hover === c.cluster ? 'border-accent/40' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span className="size-3 rounded-sm" style={{ background: CATEGORICAL[c.cluster % CATEGORICAL.length] }} />
                    <span className="font-display text-base font-medium">{c.name.charAt(0).toUpperCase() + c.name.slice(1)}</span>
                  </span>
                  <span className="num text-xs text-faint">{c.n_cells} cells</span>
                </div>
                <Signature sig={c.signature} max={maxZ} />
              </button>
            </li>
          ))}
      </ul>
    </div>
  )
}

/** Five small bars: how each variable's trend in this group compares with the regional average. */
function Signature({ sig, max }: { sig: ClusterSummary['signature']; max: number }) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {VARIABLE_IDS.map((v) => {
        const z = Math.max(-max, Math.min(max, sig[v] ?? 0))
        const h = Math.max(2, (Math.abs(z) / max) * 22)
        return (
          <div key={v} className="flex flex-col items-center" title={`${VARS[v].short}: ${signed(sig[v])} standard deviations`}>
            <div className="relative h-12 w-full">
              <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
              <span
                className="absolute left-1/2 w-3 -translate-x-1/2 rounded-sm"
                style={{ height: h, top: z >= 0 ? 24 - h : 24, background: VARS[v].color, opacity: Math.abs(z) >= 0.5 ? 1 : 0.35 }}
              />
            </div>
            <span style={{ color: VARS[v].color }}>
              <VarIcon id={v} size={13} />
            </span>
          </div>
        )
      })}
    </div>
  )
}
