import { useEffect, useMemo, useRef } from 'react'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import { globeStyle } from '../lib/map.ts'

/**
 * Night globe for the opening: it turns in from the Atlantic, slows down over the
 * Mediterranean, then keeps breathing very slowly. Not interactive (the page scrolls through it).
 */
export default function Globe({ onArrived }: { onArrived?: () => void }) {
  const map = useRef<MapRef>(null)
  const style = useMemo(() => globeStyle(), [])
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const breathe = (bearing: number) => {
    const m = map.current
    if (!m || !alive.current) return
    m.easeTo({ bearing, center: [15 + bearing / 2, 30], duration: 18000, easing: (t) => t * (2 - t) })
    m.once('moveend', () => breathe(-bearing))
  }

  const arrive = () => {
    const m = map.current
    if (!m) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = { center: [15, 30] as [number, number], zoom: 1.85, padding: { top: 0, bottom: 300, left: 0, right: 0 } }
    if (reduced) {
      m.jumpTo(target)
      onArrived?.()
      return
    }
    m.flyTo({ ...target, duration: 6500, curve: 1.2, essential: true })
    m.once('moveend', () => {
      onArrived?.()
      breathe(5)
    })
  }

  return (
    <Map
      ref={map}
      initialViewState={{ longitude: -70, latitude: 12, zoom: 0.7 }}
      mapStyle={style}
      interactive={false}
      attributionControl={{ compact: true, customAttribution: 'Natural Earth' }}
      onLoad={arrive}
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
