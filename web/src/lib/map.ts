/** Map settings shared by every map (MapLibre GL JS through react-map-gl). */

import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// MapLibre 6 runs its heavy work in a separate worker file that Vite does not find by itself.
// `?url` makes Vite ship that file, and setWorkerUrl tells MapLibre where it is.
setWorkerUrl(workerUrl)

const key = import.meta.env.VITE_CARTO_KEY ?? ''

/** CARTO dark basemaps. Needs a free key in web/.env (see web/.env.example). */
const carto = (name: string) =>
  `https://basemaps.cartocdn.com/gl/${name}-gl-style/style.json${key ? `?key=${key}` : ''}`

export const STYLE_DARK = carto('dark-matter')
export const STYLE_DARK_NO_LABELS = carto('dark-matter-nolabels')

/** Study area (same box as common/config.py). */
export const REGION_BOUNDS: [[number, number], [number, number]] = [
  [-10, 25],
  [40, 47],
]

/** Camera centred on the study area. */
export const MEDITERRANEAN = { center: [15, 36] as [number, number], zoom: 3.4, pitch: 0, bearing: 0 }
