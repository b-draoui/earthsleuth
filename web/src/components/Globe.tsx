import { useRef } from 'react'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import { MEDITERRANEAN, STYLE_DARK_NO_LABELS } from '../lib/map.ts'

/** Dark globe that starts over the Atlantic and slowly flies to the Mediterranean. */
export default function Globe() {
  const map = useRef<MapRef>(null)

  return (
    <Map
      ref={map}
      initialViewState={{ longitude: -45, latitude: 15, zoom: 1.1 }}
      projection="globe"
      mapStyle={STYLE_DARK_NO_LABELS}
      interactive={false}
      attributionControl={{ compact: true }}
      onLoad={() =>
        // bottom padding keeps the region above the title; tune zoom/duration to taste
        map.current?.flyTo({ ...MEDITERRANEAN, zoom: 2.8, padding: { top: 0, bottom: 260, left: 0, right: 0 }, duration: 7000, essential: true })
      }
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
