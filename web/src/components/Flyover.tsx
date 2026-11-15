import type { ExpressionSpecification } from 'maplibre-gl'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import Map, { Layer, Source, type MapRef } from 'react-map-gl/maplibre'
import { useNavigate } from 'react-router'
import { api } from '../lib/api.ts'
import { nearestLandCell, useCells } from '../lib/cells.ts'
import { SCALES, cssGradient, divergingExpression } from '../lib/colors.ts'
import { plain, signed } from '../lib/format.ts'
import { globeStyle } from '../lib/map.ts'
import { useFetch } from '../lib/useFetch.ts'
import CitySearch from './CitySearch.tsx'
import SimulatedBadge from './SimulatedBadge.tsx'

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// scroll progress -> story
const DIVE_END = 0.26
const YEARS_START = 0.3
const YEARS_END = 0.88

/**
 * The opening flight: scrolling dives from the globe into the Mediterranean, then plays
 * 24 years of air temperature, one year per step of the scroll. Colours are each cell's
 * yearly anomaly (its year minus its own 2001–2024 average), straight from the trends file.
 */
export default function Flyover() {
  const ref = useRef<HTMLElement>(null)
  const map = useRef<MapRef>(null)
  const navigate = useNavigate()
  const style = useMemo(() => globeStyle(), [])
  const { data: trends } = useFetch('trends:t2m', () => api.trends('t2m'))
  const { data: rs } = useFetch('rseries:t2m:mediterranean_north_africa', () => api.regionalSeries('t2m', 'mediterranean_north_africa'))
  const { data: cells } = useCells()
  const [phase, setPhase] = useState<'intro' | 'years' | 'end'>('intro')
  const [yearIdx, setYearIdx] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  const years = trends?.meta.years ?? []
  const year = years[yearIdx] ?? 2001
  const phone = typeof window !== 'undefined' && window.innerWidth < 768

  const apply = (p: number) => {
    const m = map.current?.getMap()
    if (m) {
      const t = ease(clamp(p / DIVE_END))
      m.jumpTo({
        center: [15, lerp(28, phone ? 38.5 : 35.2, t)],
        zoom: lerp(phone ? 0.9 : 1.6, phone ? 2.2 : 3.7, t),
        pitch: lerp(0, phone ? 18 : 28, t),
        bearing: lerp(12, -6, t),
      })
      if (m.getLayer('fly-cells')) m.setPaintProperty('fly-cells', 'fill-opacity', 0.88 * clamp((p - 0.14) / 0.14))
    }
    const idx = Math.round(clamp((p - YEARS_START) / (YEARS_END - YEARS_START)) * Math.max(years.length - 1, 0))
    if (idx !== yearIdx) setYearIdx(idx)
    const next = p < YEARS_START - 0.02 ? 'intro' : p < YEARS_END + 0.03 ? 'years' : 'end'
    if (next !== phase) setPhase(next)
  }
  useMotionValueEvent(scrollYProgress, 'change', apply)

  const fill: ExpressionSpecification | null = trends
    ? divergingExpression(['coalesce', ['get', `y${year}`], 0] as ExpressionSpecification, trends.meta.anomaly_max, 'temperature')
    : null

  const yearly = rs?.yearly_anomaly ?? []
  const yMax = Math.max(...yearly.map((v) => Math.abs(v ?? 0)), 0.01)
  const first5 = mean(yearly.slice(0, 5))
  const last5 = mean(yearly.slice(-5))
  const unit = trends?.meta.unit ?? '°C'

  return (
    <section ref={ref} id="flyover" className="relative h-[340vh] bg-space" aria-label="Fly over 24 years of temperature">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <Map
          ref={map}
          initialViewState={{ longitude: 15, latitude: 28, zoom: phone ? 0.9 : 1.6, bearing: 12 }}
          mapStyle={style}
          interactive={false}
          attributionControl={false}
          onLoad={() => apply(scrollYProgress.get())}
          style={{ position: 'absolute', inset: 0 }}
        >
          {trends && fill && (
            <Source id="fly" type="geojson" data={trends}>
              <Layer id="fly-cells" type="fill" paint={{ 'fill-color': fill, 'fill-opacity': 0, 'fill-color-transition': { duration: 250 } }} />
            </Source>
          )}
        </Map>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(3,6,13,0.8)_100%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-abyss to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-abyss to-transparent" />

        <div className="absolute top-20 right-5 md:top-24 md:right-8">
          <SimulatedBadge compact />
        </div>

        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-x-0 bottom-[12vh] mx-auto max-w-xl px-6 text-center"
            >
              <p className="eyebrow">Keep scrolling</p>
              <p className="mt-3 font-display text-2xl leading-snug md:text-4xl">Fly in. Then watch 24 years of temperature, one year at a time.</p>
              <p className="mt-3 text-sm text-muted">Each square is about 100 km of land, coloured by how warm its year was against its own 2001–2024 average.</p>
            </motion.div>
          )}
          {phase === 'end' && (
            <motion.div
              key="end"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.6 }}
              className="glass absolute inset-x-4 bottom-[8vh] mx-auto max-w-xl rounded-3xl p-6 text-center md:p-8"
            >
              {first5 !== null && last5 !== null && (
                <p className="font-display text-xl leading-snug md:text-2xl">
                  The first five years averaged <span className="num text-[#92c5de]">{signed(first5)} {unit}</span>, the last five{' '}
                  <span className="num text-[#f4a582]">{signed(last5)} {unit}</span>.
                </p>
              )}
              <p className="mt-2 text-sm text-muted">A real trend, or a lucky run of warm years? The tests answer that next.</p>
              <CitySearch
                big
                placeholder="Or jump to your city…"
                className="mx-auto mt-5 max-w-sm text-left"
                onPick={(c) => {
                  const i = cells ? nearestLandCell(cells, c.lat, c.lon) : -1
                  navigate(i >= 0 && cells ? `/explore?v=t2m&cell=${cells.cells[i].id}` : '/explore?v=t2m')
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {phase !== 'intro' && trends && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'years' ? 1 : 0.35 }}
            className="pointer-events-none absolute top-24 left-5 md:top-auto md:bottom-[10vh] md:left-10"
          >
            <p className="num font-display text-6xl font-semibold tracking-tight md:text-8xl">{year}</p>
            {yearly[yearIdx] !== undefined && yearly[yearIdx] !== null && (
              <p className="num mt-1 text-sm text-muted md:text-base">
                whole region <span className="text-ink">{signed(yearly[yearIdx])} {unit}</span> vs. its average
              </p>
            )}
            <div className="mt-4 flex h-14 items-center gap-[3px]" aria-hidden>
              {yearly.map((v, i) => {
                const h = (Math.abs(v ?? 0) / yMax) * 26
                return (
                  <span key={i} className="relative block h-full w-[6px] md:w-[8px]">
                    <span
                      className="absolute left-0 w-full rounded-[2px] transition-opacity"
                      style={{
                        height: Math.max(h, 1.5),
                        top: (v ?? 0) >= 0 ? 28 - h : 28,
                        background: (v ?? 0) >= 0 ? SCALES.temperature[5] : SCALES.temperature[1],
                        opacity: i === yearIdx ? 1 : i < yearIdx ? 0.55 : 0.15,
                      }}
                    />
                  </span>
                )
              })}
            </div>
            <div className="mt-3 w-56">
              <div className="h-1.5 rounded-full" style={{ background: cssGradient('temperature') }} />
              <p className="num mt-1 flex justify-between text-[10px] text-faint">
                <span>−{plain(trends.meta.anomaly_max)} colder</span>
                <span>warmer +{plain(trends.meta.anomaly_max)}</span>
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  )
}

function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
