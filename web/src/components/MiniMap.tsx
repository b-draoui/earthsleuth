import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CITIES } from '../lib/cities.ts'
import type { CellsMatrix } from '../lib/types.ts'

const LON0 = -10.5
const LAT1 = 47.5
const K = 1.25
export const STUDY_VIEW: [number, number, number, number] = [-10.5, 40.5, 24.5, 47.5]

const px = (lon: number) => lon - LON0
const py = (lat: number) => (LAT1 - lat) * K

let coastPromise: Promise<string> | null = null
type Ring = [number, number][]
function loadCoast(): Promise<string> {
  coastPromise ??= fetch('/geo/land-50m-region.json')
    .then((r) => r.json())
    .then((g: { features: { geometry: { type: string; coordinates: unknown } }[] }) => {
      const rings: Ring[] = []
      for (const f of g.features) {
        const geom = f.geometry
        if (geom.type === 'Polygon') rings.push(...(geom.coordinates as Ring[]))
        else if (geom.type === 'MultiPolygon') for (const poly of geom.coordinates as Ring[][]) rings.push(...poly)
      }
      return rings
        .map((ring) => 'M' + ring.map(([lo, la]) => `${px(lo).toFixed(2)} ${py(la).toFixed(2)}`).join('L') + 'Z')
        .join('')
    })
    .catch(() => '')
  return coastPromise
}

function useCoast(): string {
  const [d, setD] = useState('')
  useEffect(() => {
    let alive = true
    loadCoast().then((x) => alive && setD(x))
    return () => {
      alive = false
    }
  }, [])
  return d
}

export interface MiniMapProps {
  m: CellsMatrix
  color: (i: number) => string | null
  opacity?: (i: number) => number
  view?: [number, number, number, number]
  cities?: boolean
  box?: [number, number, number, number] | null
  tooltip?: (i: number) => ReactNode
  onCell?: (i: number) => void
  className?: string
  label: string
}

export default function MiniMap({ m, color, opacity, view = STUDY_VIEW, cities = false, box, tooltip, onCell, className = '', label }: MiniMapProps) {
  const coast = useCoast()
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const [lo0, lo1, la0, la1] = view
  const w = lo1 - lo0
  const h = (la1 - la0) * K
  const font = w / 58

  const rects = useMemo(
    () =>
      m.cells.map((c, i) => {
        const fill = color(i)
        if (!fill) return null
        return (
          <rect
            key={c.id}
            x={px(c.lon - 0.5)}
            y={py(c.lat + 0.5)}
            width={1}
            height={K}
            fill={fill}
            fillOpacity={opacity ? opacity(i) : 0.92}
            stroke="#0c0d0e"
            strokeWidth={0.05}
            onMouseEnter={tooltip ? (e) => setHover({ i, x: e.clientX, y: e.clientY }) : undefined}
            onMouseMove={tooltip ? (e) => setHover({ i, x: e.clientX, y: e.clientY }) : undefined}
            onClick={onCell ? () => onCell(i) : undefined}
            style={onCell ? { cursor: 'pointer' } : undefined}
          />
        )
      }),
    [m, color, opacity],
  )

  return (
    <div className={`relative ${className}`} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`${px(lo0)} ${py(la1)} ${w} ${h}`} role="img" aria-label={label} className="block h-auto w-full" preserveAspectRatio="xMidYMid meet">
        <path d={coast} fill="#101a2c" />
        {rects}
        <path d={coast} fill="none" stroke="#a7dff2" strokeOpacity={0.45} strokeWidth={0.06} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 0.7 }} />
        {box && (
          <rect
            x={px(box[0])}
            y={py(box[3])}
            width={box[1] - box[0]}
            height={(box[3] - box[2]) * K}
            fill="none"
            stroke="#e7c48f"
            strokeDasharray={`${w / 120} ${w / 200}`}
            strokeWidth={w / 400}
          />
        )}
        {cities &&
          CITIES.filter((c) => c.tier === 1 && c.lon > lo0 && c.lon < lo1 && c.lat > la0 && c.lat < la1).map((c) => (
            <g key={c.name} pointerEvents="none">
              <circle cx={px(c.lon)} cy={py(c.lat)} r={font * 0.28} fill="#fff" stroke="#0c0d0e" strokeWidth={font * 0.08} />
              <text
                x={px(c.lon) + (c.side === 'l' ? -font * 0.5 : font * 0.5)}
                y={py(c.lat)}
                dy="0.35em"
                textAnchor={c.side === 'l' ? 'end' : 'start'}
                fontSize={font}
                fill="#fff"
                stroke="#0c0d0e"
                strokeWidth={font * 0.22}
                paintOrder="stroke"
                fontFamily="IBM Plex Sans Variable, system-ui, sans-serif"
              >
                {c.name}
              </text>
            </g>
          ))}
      </svg>
      {hover && tooltip && (
        <div className="glass pointer-events-none fixed z-50 max-w-60 rounded-xl px-3 py-2 text-xs" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          {tooltip(hover.i)}
        </div>
      )}
    </div>
  )
}

export function divergingColor(scale: readonly string[], value: number | null, max: number): string | null {
  if (value === null) return null
  const t = Math.max(-1, Math.min(1, value / (max || 1)))
  const idx = Math.round(((t + 1) / 2) * (scale.length - 1))
  return scale[idx]
}
