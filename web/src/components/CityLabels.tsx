import { Marker } from 'react-map-gl/maplibre'
import { CITIES, TIER2_ZOOM } from '../lib/cities.ts'

/**
 * City dots and names as HTML markers (the basemap has no font server).
 * They never catch the mouse, so cells under them stay clickable.
 */
export default function CityLabels({ zoom, maxTier = 2 }: { zoom: number; maxTier?: 1 | 2 }) {
  return (
    <>
      {CITIES.filter((c) => c.tier === 1 || (maxTier === 2 && zoom >= TIER2_ZOOM)).map((c) => (
        <Marker key={c.name} longitude={c.lon} latitude={c.lat} anchor="center" style={{ pointerEvents: 'none' }}>
          <span className="relative block size-0">
            <span className="absolute -top-[3px] -left-[3px] size-[6px] rounded-full border border-abyss bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
            <span
              className={`absolute top-1/2 -translate-y-1/2 text-[11px] whitespace-nowrap select-none ${
                c.tier === 1 ? 'font-medium text-white/90' : 'text-white/70'
              } ${c.side === 'l' ? 'right-[7px]' : 'left-[7px]'}`}
              style={{ textShadow: '0 0 4px #000, 0 1px 3px #000' }}
            >
              {c.name}
            </span>
          </span>
        </Marker>
      ))}
    </>
  )
}
