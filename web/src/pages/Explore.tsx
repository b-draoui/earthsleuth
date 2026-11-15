import type { ExpressionSpecification, MapLayerMouseEvent } from 'maplibre-gl'
import type { FeatureCollection, Point, Polygon } from 'geojson'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre'
import { useSearchParams } from 'react-router'
import { CellPanel, RegionPanel } from '../components/explore/DetailPanels.tsx'
import Legend, { type LegendHover } from '../components/explore/Legend.tsx'
import CompareMaps, { compareMax } from '../components/explore/CompareMaps.tsx'
import Timeline from '../components/explore/Timeline.tsx'
import PageTransition from '../components/PageTransition.tsx'
import SimulatedBadge from '../components/SimulatedBadge.tsx'
import VarIcon from '../components/VarIcon.tsx'
import { api } from '../lib/api.ts'
import { QUIET, SCALES, SCALE_OF, divergingExpression } from '../lib/colors.ts'
import { latLon, pValue, signed } from '../lib/format.ts'
import { PLACE_LABELS, regionChipAt, regionStyle } from '../lib/map.ts'
import { nearestCity } from '../lib/cities.ts'
import CityLabels from '../components/CityLabels.tsx'
import CitySearch from '../components/CitySearch.tsx'
import { nearestLandCell, useCells } from '../lib/cells.ts'
import type { City } from '../lib/cities.ts'
import { VARIABLE_IDS, type Region, type TrendCell, type VariableId } from '../lib/types.ts'
import { prefetch, useFetch } from '../lib/useFetch.ts'
import { VARS } from '../lib/variables.ts'

type Mode = 'trend' | 'year' | 'compare' | 'opposite'
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'trend', label: 'Trend', hint: 'Change per decade, 2001–2024. Bright cells with a dot passed the significance test.' },
  { id: 'year', label: 'Yearly', hint: 'How unusual each year was, compared with the 2001–2024 average. Press play.' },
  { id: 'compare', label: 'Compare', hint: 'First five years against the last five. Drag the handle. A way of looking, not a test: the Trend view holds the tests.' },
  { id: 'opposite', label: 'Opposites', hint: 'Only significant trends, by direction. Where does the same variable go opposite ways?' },
]
const HOME_BOUNDS: [[number, number], [number, number]] = [
  [-11, 23.5],
  [41, 48.5],
]
const BIG = 1e9
const TINY: Record<VariableId, string> = { t2m: 'Temp.', precip: 'Rain', soil_moisture: 'Soil', et: 'Evap.', ndvi: 'Green' }

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const variable = (VARIABLE_IDS.includes(params.get('v') as VariableId) ? params.get('v') : 't2m') as VariableId
  const mode = (MODES.some((m) => m.id === params.get('mode')) ? params.get('mode') : 'trend') as Mode
  const cell = params.get('cell')
  const regionId = params.get('region')
  const onlySig = params.get('sig') === '1'
  const [year, setYear] = useState(2024)
  const [playing, setPlaying] = useState(false)
  const [hover, setHover] = useState<{ x: number; y: number; props: TrendCell } | null>(null)
  const [legendHover, setLegendHover] = useState<LegendHover>(null)
  const [zoom, setZoom] = useState(3.8)
  const [more, setMore] = useState(false)
  const map = useRef<MapRef>(null)
  const panel = useRef<HTMLElement>(null)
  const style = useMemo(() => regionStyle(), [])
  const { data: cellsM } = useCells()

  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k)
        else next.set(k, v)
      }
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const { data: trends, error } = useFetch(`trends:${variable}`, () => api.trends(variable))
  const { data: regions = [] } = useFetch('regions', api.regions)
  const { data: regionalAll } = useFetch(`regionalAll:${variable}`, () => api.regionalAll(variable))
  const { data: mainSeries } = useFetch(`rseries:${variable}:mediterranean_north_africa`, () =>
    api.regionalSeries(variable, 'mediterranean_north_africa'),
  )

  useEffect(() => {
    if (!trends) return
    const t = window.setTimeout(() => VARIABLE_IDS.forEach((v) => prefetch(`trends:${v}`, () => api.trends(v))), 600)
    return () => window.clearTimeout(t)
  }, [trends])

  const region = regions.find((r) => r.id === regionId && r.id !== 'mediterranean_north_africa') ?? null
  const scale = SCALE_OF[variable]
  const meta = trends?.meta
  const years = meta?.years ?? []

  const valueExpr: ExpressionSpecification =
    mode === 'year' ? ['coalesce', ['get', `y${year}`], 0] : ['get', 'slope_dec']

  const fillColor: ExpressionSpecification = useMemo(() => {
    if (!meta) return ['literal', QUIET] as unknown as ExpressionSpecification
    if (mode === 'opposite') {
      return ['match', ['get', 'direction'], 'up', SCALES[scale][5], 'down', SCALES[scale][1], QUIET] as ExpressionSpecification
    }
    return divergingExpression(valueExpr, mode === 'year' ? meta.anomaly_max : meta.slope_max, scale)
  }, [meta, mode, scale, year])

  const fillOpacity: ExpressionSpecification = useMemo(() => {
    if (legendHover) {
      const inside: ExpressionSpecification =
        'direction' in legendHover
          ? ['==', ['get', 'direction'], legendHover.direction]
          : ['all', ['>=', valueExpr, Math.max(legendHover.lo, -BIG)], ['<', valueExpr, Math.min(legendHover.hi, BIG)]]
      return ['case', inside, 0.95, 0.07] as ExpressionSpecification
    }
    if (mode === 'trend') return ['case', ['get', 'significant'], 0.92, onlySig ? 0.05 : 0.3] as ExpressionSpecification
    if (mode === 'opposite') return ['match', ['get', 'direction'], 'none', 0.45, 0.9] as ExpressionSpecification
    return ['literal', 0.88] as unknown as ExpressionSpecification
  }, [legendHover, mode, onlySig, year])

  const dots: FeatureCollection<Point> | null = useMemo(() => {
    if (!trends) return null
    return {
      type: 'FeatureCollection',
      features: trends.features
        .filter((f) => f.properties.significant)
        .map((f) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [f.properties.lon, f.properties.lat] } })),
    }
  }, [trends])

  const regionBox: FeatureCollection<Polygon> | null = region
    ? {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [[[region.bbox[0], region.bbox[2]], [region.bbox[1], region.bbox[2]], [region.bbox[1], region.bbox[3]], [region.bbox[0], region.bbox[3]], [region.bbox[0], region.bbox[2]]]],
            },
          },
        ],
      }
    : null

  const phoneTop = () => Math.max(20, (panel.current?.getBoundingClientRect().bottom ?? 300) - 64 + 8)
  const flyToRegion = (r: Region | null, duration = 1200) => {
    const m = map.current
    if (!m) return
    const wide = window.innerWidth >= 768
    const padding = wide ? { top: 90, bottom: mode === 'year' ? 150 : 90, left: 340, right: 460 } : { top: phoneTop(), bottom: 12, left: 8, right: 8 }
    if (!r) m.fitBounds(HOME_BOUNDS, { padding: wide ? { top: 70, bottom: 110, left: 320, right: 40 } : { top: phoneTop(), bottom: 12, left: 4, right: 4 }, duration })
    else m.fitBounds([[r.bbox[0], r.bbox[2]], [r.bbox[1], r.bbox[3]]], { padding, maxZoom: 5, duration: duration + 200, essential: true })
  }
  const flyToPoint = (lat: number, lon: number, duration = 1600) => {
    const m = map.current
    if (!m) return
    const wide = window.innerWidth >= 768
    m.flyTo({
      center: [lon, lat],
      zoom: Math.max(m.getZoom(), wide ? 5.4 : 4.6),
      padding: wide ? { top: 60, bottom: 60, left: 320, right: 440 } : { top: 16, bottom: Math.round(window.innerHeight * 0.58), left: 0, right: 0 },
      duration,
      essential: true,
    })
  }
  useEffect(() => {
    const m = map.current
    if (!cell || !m) return
    const [la, lo] = cell.split('_').map(Number)
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return
    if (!m.getBounds().contains([lo, la])) flyToPoint(la, lo)
  }, [cell])

  const pickCity = (c: City) => {
    if (!cellsM) return
    const i = nearestLandCell(cellsM, c.lat, c.lon)
    if (i < 0) return
    set({ cell: cellsM.cells[i].id, region: null })
    flyToPoint(c.lat, c.lon)
  }

  const onMove = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (f) setHover({ x: e.point.x, y: e.point.y, props: f.properties as TrendCell })
    else setHover(null)
  }
  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (f) set({ cell: (f.properties as TrendCell).cell_id })
  }

  const cmpMax = useMemo(() => (trends ? compareMax(trends) : 1), [trends])
  const selectRegion = (id: string | null) => {
    set({ region: id, cell: null })
    flyToRegion(id ? (regions.find((x) => x.id === id) ?? null) : null)
  }
  const idv = VARS[variable]
  const mainStats = regionalAll?.find((r) => r.region === 'mediterranean_north_africa')

  return (
    <PageTransition className="relative h-[100svh] overflow-hidden bg-space">
      <h1 className="sr-only">Explore the map</h1>
      <div className="absolute inset-0 top-16">
        <Map
          ref={map}
          initialViewState={{ bounds: HOME_BOUNDS, fitBoundsOptions: { padding: { top: 30, bottom: 80, left: window.innerWidth >= 768 ? 320 : 10, right: 30 } } }}
          mapStyle={style}
          minZoom={1.8}
          maxZoom={7.5}
          maxBounds={window.innerWidth >= 768 ? [-40, 5, 70, 62] : [-70, -30, 100, 80]}
          dragRotate={false}
          pitchWithRotate={false}
          interactiveLayerIds={['cells-fill']}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onClick={onClick}
          cursor={hover ? 'pointer' : 'grab'}
          attributionControl={{ compact: true, customAttribution: 'Natural Earth' }}
          onLoad={() => {
            if (region) flyToRegion(region)
            else if (cell) {
              const [la, lo] = cell.split('_').map(Number)
              if (Number.isFinite(la) && Number.isFinite(lo)) flyToPoint(la, lo, 1800)
            } else if (window.innerWidth < 768) flyToRegion(null, 0)
            if (map.current) setZoom(map.current.getZoom())
          }}
          onZoomEnd={(e) => setZoom(e.viewState.zoom)}
          style={{ position: 'absolute', inset: 0 }}
        >
          {trends && (
            <Source id="cells" type="geojson" data={trends}>
              <Layer
                id="cells-fill"
                type="fill"
                beforeId="sea"
                paint={{
                  'fill-color': fillColor,
                  'fill-opacity': fillOpacity,
                  'fill-color-transition': { duration: 700 },
                  'fill-opacity-transition': { duration: 350 },
                  'fill-outline-color': 'rgba(12,13,14,0.18)',
                }}
              />
              <Layer
                id="cells-hover"
                type="line"
                filter={['==', ['get', 'cell_id'], hover?.props.cell_id ?? '']}
                paint={{ 'line-color': '#ffffff', 'line-width': 1.4, 'line-opacity': 0.9 }}
              />
              <Layer
                id="cells-selected"
                type="line"
                filter={['==', ['get', 'cell_id'], cell ?? '']}
                paint={{ 'line-color': '#ece8e1', 'line-width': 2.6 }}
              />
            </Source>
          )}
          {dots && (
            <Source id="sig-dots" type="geojson" data={dots}>
              <Layer
                id="sig-dots"
                type="circle"
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 0.9, 5, 1.8, 7, 3],
                  'circle-color': '#f6f1e7',
                  'circle-opacity': mode === 'trend' && !legendHover ? 0.8 : 0,
                  'circle-opacity-transition': { duration: 400 },
                }}
              />
            </Source>
          )}
          {regionBox && (
            <Source id="region-box" type="geojson" data={regionBox}>
              <Layer id="region-box" type="line" paint={{ 'line-color': '#e7c48f', 'line-width': 1.6, 'line-dasharray': [3, 2] }} />
            </Source>
          )}
          <CityLabels zoom={zoom} />
          {PLACE_LABELS.map((p) => (
            <Marker key={p.name} longitude={p.lon} latitude={p.lat} anchor="center" style={{ pointerEvents: 'none' }}>
              <span
                className={`font-display text-[10px] tracking-[0.35em] uppercase select-none ${p.kind === 'sea' ? 'text-glow/50 italic' : 'text-white/40'}`}
                style={{ textShadow: '0 1px 6px #000' }}
              >
                {p.name}
              </span>
            </Marker>
          ))}
          {regions
            .filter((r) => r.id !== 'mediterranean_north_africa')
            .map((r) => (
              <Marker
                key={r.id}
                longitude={regionChipAt(r.id, r.bbox)[0]}
                latitude={regionChipAt(r.id, r.bbox)[1]}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation()
                  selectRegion(r.id === regionId ? null : r.id)
                }}
              >
                <button
                  aria-pressed={r.id === regionId}
                  title={`Open ${r.label}`}
                  className={`hidden rounded-[3px] border px-2.5 py-1 md:inline-block font-display text-[10px] tracking-[0.25em] uppercase backdrop-blur-sm transition-all hover:scale-110 hover:border-sand hover:text-sand ${
                    r.id === regionId ? 'border-sand bg-sand/15 text-sand' : 'border-white/20 bg-abyss/50 text-white/70'
                  }`}
                >
                  {r.label}
                </button>
              </Marker>
            ))}
        </Map>

        {mode === 'compare' && trends && meta && (
          <CompareMaps data={trends} scale={scale} max={cmpMax} unit={meta.unit} selected={cell} onCell={(id) => set({ cell: id })} />
        )}

        {hover && mode !== 'compare' && (
          <div className="glass pointer-events-none absolute z-20 w-56 rounded-xl px-3 py-2.5 text-xs" style={{ left: hover.x + 16, top: hover.y + 16 }}>
            <p className="num text-faint">
              {nearestCity(hover.props.lat, hover.props.lon) && (
                <span className="font-sans text-ink">{nearestCity(hover.props.lat, hover.props.lon)!.name} area · </span>
              )}
              {latLon(hover.props.lat, hover.props.lon)}
            </p>
            {mode === 'year' ? (
              <p className="num mt-1 text-sm text-ink">
                {year}: {signed(hover.props[`y${year}`] as number)} {meta?.unit} vs. usual
              </p>
            ) : (
              <p className="num mt-1 text-sm text-ink">
                {signed(hover.props.slope_dec)} {idv.perDecade(meta?.unit ?? '')}
              </p>
            )}
            <p className={`mt-1 ${hover.props.significant ? 'text-accent' : 'text-muted'}`}>
              {hover.props.significant ? '● Significant trend' : '○ Not significant: could be chance'} · {pValue(hover.props.q, 'q')}
            </p>
            <p className="mt-1 text-faint">Click for the full record</p>
          </div>
        )}
      </div>

      <motion.section
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        aria-label="Layers"
        ref={panel}
        className={`glass scroll-thin absolute top-20 left-3 z-30 ${cell || region ? 'max-md:hidden' : ''} max-h-[calc(100svh-6rem)] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl p-4 md:left-5 md:w-[290px] md:p-5`}
      >
        <div className="flex items-center justify-between">
          <p className="eyebrow">02 · The lab</p>
          <SimulatedBadge compact />
        </div>
        <CitySearch onPick={pickCity} className="mt-3" />

        <div role="radiogroup" aria-label="Variable" className="mt-3 grid grid-cols-5 gap-1 md:mt-4 md:grid-cols-1">
          {VARIABLE_IDS.map((v) => {
            const on = v === variable
            return (
              <button
                key={v}
                role="radio"
                aria-checked={on}
                onClick={() => set({ v })}
                className={`group relative flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-[10px] transition-all md:flex-row md:gap-3 md:px-3 md:text-left md:text-sm ${
                  on ? 'bg-white/[0.07] text-ink' : 'text-muted hover:bg-white/[0.04] hover:text-ink'
                }`}
              >
                {on && <motion.span layoutId="var-glow" className="absolute inset-x-3 bottom-0 h-[3px] rounded-full md:inset-x-auto md:inset-y-1.5 md:left-0 md:h-auto md:w-[3px]" style={{ background: VARS[v].color, boxShadow: "none" }} />}
                <span style={{ color: VARS[v].color }}>
                  <VarIcon id={v} size={18} />
                </span>
                <span className="whitespace-nowrap md:hidden">{TINY[v]}</span>
                <span className="hidden whitespace-nowrap md:inline">{VARS[v].short}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-5 grid grid-cols-4 rounded-[3px] border border-line p-0.5 text-[11px]" role="tablist" aria-label="View">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => {
                setPlaying(false)
                set({ mode: m.id })
              }}
              className={`relative rounded-[3px] px-2 py-1.5 transition-colors ${mode === m.id ? 'text-ink' : 'text-muted hover:text-ink'}`}
            >
              {mode === m.id && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-[2px] bg-white/10" />}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setMore(!more)}
          aria-expanded={more}
          className="mt-3 w-full rounded-[3px] border border-line py-1.5 text-xs text-muted md:hidden"
        >
          {more ? 'Hide legend' : 'Legend and details'}
        </button>

        <div className={more ? '' : 'hidden md:block'}>
        <p className="mt-2 text-xs leading-relaxed text-faint">{MODES.find((m) => m.id === mode)?.hint}</p>

        <div className="mt-5">
          {meta ? (
            <Legend
              mode={mode === 'compare' ? 'year' : mode}
              scale={scale}
              max={mode === 'compare' ? cmpMax : mode === 'year' ? meta.anomaly_max : meta.slope_max}
              unit={meta.unit}
              words={[idv.down, idv.up]}
              onHover={setLegendHover}
            />
          ) : (
            <div className="skeleton h-16 rounded-xl" />
          )}
        </div>

        {mode === 'trend' && (
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 text-xs text-muted">
            Show only significant cells
            <input type="checkbox" checked={onlySig} onChange={(e) => set({ sig: e.target.checked ? '1' : null })} className="size-4 accent-[var(--color-accent)]" />
          </label>
        )}

        {meta && (
          <p className="num mt-4 rounded-xl border border-line/60 px-3 py-2 text-xs leading-relaxed text-muted">
            <strong className="text-ink">{meta.n_significant}</strong> of {meta.n_cells} cells have a significant trend
            {mainStats && (
              <>
                {' '}· whole region {signed(mainStats.regional.slope_per_decade)} {idv.perDecade(mainStats.unit)},{' '}
                {mainStats.regional.significant ? 'significant' : 'not significant'}
              </>
            )}
          </p>
        )}

        <div className="mt-5 hidden md:block">
          <p className="eyebrow mb-2">Regions</p>
          <ul className="space-y-0.5">
            {(regionalAll ?? [])
              .filter((r) => r.region !== 'mediterranean_north_africa')
              .map((r) => {
                const on = r.region === regionId
                return (
                  <li key={r.region}>
                    <button
                      onClick={() => selectRegion(on ? null : r.region)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                        on ? 'bg-sand/10 text-sand' : 'text-muted hover:bg-white/5 hover:text-ink'
                      }`}
                    >
                      <span>{r.label}</span>
                      <span className="num flex items-center gap-1.5">
                        {signed(r.regional.slope_per_decade)}
                        <span className={`size-1.5 rounded-full ${r.regional.significant ? 'bg-accent' : 'border border-faint'}`} />
                      </span>
                    </button>
                  </li>
                )
              })}
          </ul>
          <p className="mt-2 text-[10px] text-faint">● significant regional trend (p &lt; 0.05) · per decade</p>
        </div>
        </div>
      </motion.section>

      <div className="pointer-events-none absolute right-3 bottom-3 left-3 z-30 flex max-h-[58svh] md:top-20 md:right-5 md:bottom-auto md:left-auto md:max-h-[calc(100svh-6rem)]">
        <AnimatePresence mode="wait">
          {cell ? (
            <CellPanel key={`c-${cell}-${variable}`} variable={variable} cellId={cell} regions={regions} compare={mode === 'compare'} onVariable={(v) => set({ v })} onClose={() => set({ cell: null })} />
          ) : region ? (
            <RegionPanel
              key={`r-${region.id}-${variable}`}
              variable={variable}
              region={region}
              compare={mode === 'compare'}
              onClose={() => {
                set({ region: null })
                flyToRegion(null)
              }}
            />
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {mode === 'year' && meta && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="pointer-events-none absolute bottom-4 left-3 z-20 w-[calc(100%-1.5rem)] md:left-[320px] md:w-[min(760px,calc(100%-820px))] md:min-w-[460px]"
          >
            <Timeline
              years={years}
              year={year}
              onYear={setYear}
              playing={playing}
              onPlaying={setPlaying}
              regional={mainSeries?.yearly_anomaly}
              unit={meta.unit}
              color={idv.color}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="glass absolute inset-x-0 top-1/2 z-40 mx-auto max-w-md rounded-2xl p-6 text-center text-sm">
          <p className="text-rose-300">The map data could not load.</p>
          <p className="mt-2 text-muted">{error.message}</p>
        </div>
      )}
      {!trends && !error && (
        <div className="absolute inset-0 top-16 z-10 grid place-items-center">
          <p className="eyebrow animate-pulse">Loading {idv.short.toLowerCase()} · {variable}</p>
        </div>
      )}
    </PageTransition>
  )
}
