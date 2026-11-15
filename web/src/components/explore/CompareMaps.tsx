import type { ExpressionSpecification, MapLayerMouseEvent } from 'maplibre-gl'
import { useMemo, useRef, useState } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import { divergingExpression, type ScaleName } from '../../lib/colors.ts'
import { latLon, signed } from '../../lib/format.ts'
import { regionStyle } from '../../lib/map.ts'
import { nearestCity } from '../../lib/cities.ts'
import CityLabels from '../CityLabels.tsx'
import type { TrendCell, TrendsGeoJSON } from '../../lib/types.ts'

import { AFTER, BEFORE } from '../../lib/periods.ts'

function meanOf(props: TrendCell, years: number[]): number {
  let sum = 0
  for (const y of years) sum += (props[`y${y}`] as number | null) ?? 0
  return sum / years.length
}

function meanExpr(years: number[]): ExpressionSpecification {
  return ['/', ['+', ...years.map((y) => ['coalesce', ['get', `y${y}`], 0])], years.length] as unknown as ExpressionSpecification
}

export function compareMax(data: TrendsGeoJSON): number {
  const values: number[] = []
  for (const f of data.features) {
    values.push(Math.abs(meanOf(f.properties, BEFORE)), Math.abs(meanOf(f.properties, AFTER)))
  }
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length * 0.95)] || 1
}

export default function CompareMaps({
  data,
  scale,
  max,
  unit,
  selected,
  onCell,
}: {
  data: TrendsGeoJSON
  scale: ScaleName
  max: number
  unit: string
  selected: string | null
  onCell: (cellId: string) => void
}) {
  const style = useMemo(() => regionStyle(), [])
  const wide = typeof window !== 'undefined' && window.innerWidth >= 768
  const [view, setView] = useState({ longitude: wide ? 9 : 15, latitude: 36.5, zoom: wide ? 3.5 : 2.5 })
  const [split, setSplit] = useState(wide ? 58 : 50)
  const [hover, setHover] = useState<{ x: number; y: number; props: TrendCell } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const moveSplit = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect) return
    setSplit(Math.min(95, Math.max(5, ((clientX - rect.left) / rect.width) * 100)))
  }

  const side = (id: string, years: number[]) => (
    <Map
      {...view}
      onMove={(e) => setView(e.viewState)}
      mapStyle={style}
      minZoom={2.4}
      maxZoom={7.5}
      dragRotate={false}
      pitchWithRotate={false}
      interactiveLayerIds={[`cmp-${id}`]}
      onMouseMove={(e: MapLayerMouseEvent) => {
        const f = e.features?.[0]
        setHover(f ? { x: e.point.x, y: e.point.y, props: f.properties as TrendCell } : null)
      }}
      onMouseLeave={() => setHover(null)}
      onClick={(e: MapLayerMouseEvent) => {
        const f = e.features?.[0]
        if (f) onCell((f.properties as TrendCell).cell_id)
      }}
      cursor={hover ? 'pointer' : 'grab'}
      attributionControl={false}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Source id={`cmp-${id}`} type="geojson" data={data}>
        <Layer
          id={`cmp-${id}`}
          type="fill"
          beforeId="sea"
          paint={{
            'fill-color': divergingExpression(meanExpr(years), max, scale),
            'fill-opacity': 0.9,
            'fill-color-transition': { duration: 700 },
            'fill-outline-color': 'rgba(4,10,22,0.18)',
          }}
        />
        <Layer id={`cmp-${id}-sel`} type="line" filter={['==', ['get', 'cell_id'], selected ?? '']} paint={{ 'line-color': '#a99bff', 'line-width': 2.6 }} />
      </Source>
      <CityLabels zoom={view.zoom} />
    </Map>
  )

  return (
    <div
      ref={box}
      className="absolute inset-0 select-none"
      onPointerMove={(e) => dragging.current && moveSplit(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
    >
      {side('before', BEFORE)}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
        {side('after', AFTER)}
      </div>

      <div className="pointer-events-none absolute top-6 z-10 -translate-x-full pr-5 text-right" style={{ left: `${split}%` }}>
        <p className="num font-display text-2xl font-semibold text-ink" style={{ textShadow: '0 2px 12px #000' }}>2001–2005</p>
        <p className="eyebrow">before</p>
      </div>
      <div className="pointer-events-none absolute top-6 z-10 pl-5" style={{ left: `${split}%` }}>
        <p className="num font-display text-2xl font-semibold text-ink" style={{ textShadow: '0 2px 12px #000' }}>2020–2024</p>
        <p className="eyebrow">after</p>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Before / after divider"
        aria-valuemin={5}
        aria-valuemax={95}
        aria-valuenow={Math.round(split)}
        onPointerDown={(e) => {
          dragging.current = true
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => dragging.current && moveSplit(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setSplit((s) => Math.max(5, s - 3))
          if (e.key === 'ArrowRight') setSplit((s) => Math.min(95, s + 3))
        }}
        className="group absolute inset-y-0 z-20 w-8 -translate-x-1/2 cursor-ew-resize touch-none"
        style={{ left: `${split}%` }}
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-sand/80 shadow-[0_0_12px_var(--color-sand)]" />
        <span className="absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-sand/70 bg-abyss/90 text-sand transition-transform group-hover:scale-110">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 4 2.5 8 6 12M10 4l3.5 4L10 12" />
          </svg>
        </span>
      </div>

      {hover && (
        <div className="glass pointer-events-none absolute z-30 w-60 rounded-xl px-3 py-2.5 text-xs" style={{ left: hover.x + 16, top: hover.y + 16 }}>
          <p className="num text-faint">
            {nearestCity(hover.props.lat, hover.props.lon) && (
              <span className="font-sans text-ink">{nearestCity(hover.props.lat, hover.props.lon)!.name} area · </span>
            )}
            {latLon(hover.props.lat, hover.props.lon)}
          </p>
          <p className="num mt-1 text-sm text-ink">
            {signed(meanOf(hover.props, BEFORE))} → {signed(meanOf(hover.props, AFTER))} {unit}
          </p>
          <p className="mt-1 text-muted">2001–05 → 2020–24, each vs. the 24-year average</p>
          <p className={`mt-1 ${hover.props.significant ? 'text-accent' : 'text-muted'}`}>
            {hover.props.significant ? '● The full-period trend is significant' : '○ The full-period trend is not significant'}
          </p>
        </div>
      )}
    </div>
  )
}
