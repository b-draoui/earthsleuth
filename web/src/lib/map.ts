import { setWorkerUrl } from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

setWorkerUrl(workerUrl)

export const REGION_BOUNDS: [[number, number], [number, number]] = [
  [-10, 25],
  [40, 47],
]

export const MEDITERRANEAN = { center: [15, 36] as [number, number], zoom: 3.4, pitch: 0, bearing: 0 }

function graticule(step: number): FeatureCollection {
  const features: Feature[] = []
  for (let lon = -180; lon <= 180; lon += step) {
    const coords: [number, number][] = []
    for (let lat = -75; lat <= 75; lat += 2) coords.push([lon, lat])
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } })
  }
  for (let lat = -75; lat <= 75; lat += step) {
    const coords: [number, number][] = []
    for (let lon = -180; lon <= 180; lon += 2) coords.push([lon, lat])
    features.push({ type: 'Feature', properties: { lat }, geometry: { type: 'LineString', coordinates: coords } })
  }
  return { type: 'FeatureCollection', features }
}

const studyBox: Feature = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [[[-10, 25], [40, 25], [40, 47], [-10, 47], [-10, 25]]],
  },
}

export function globeStyle(): StyleSpecification {
  return {
    version: 8,
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#0a1a33',
      'horizon-color': '#3f8fb8',
      'fog-color': '#0b1830',
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 4, 0.55, 7, 0],
    },
    sources: {
      land: { type: 'geojson', data: '/geo/land-110m.json' },
      grid: { type: 'geojson', data: graticule(15) },
      study: { type: 'geojson', data: studyBox },
      bluemarble: {
        type: 'raster',
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],
        tileSize: 256,
        maxzoom: 8,
        attribution: 'Imagery: NASA GIBS, Blue Marble',
      },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': '#050d1c' } },
      { id: 'grid', type: 'line', source: 'grid', paint: { 'line-color': '#5d7fb0', 'line-opacity': 0.12, 'line-width': 0.6 } },
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': '#132036', 'fill-opacity': 1 } },
      { id: 'bluemarble', type: 'raster', source: 'bluemarble', paint: { 'raster-opacity': 0.92, 'raster-brightness-max': 0.82, 'raster-saturation': -0.1, 'raster-contrast': 0.12, 'raster-fade-duration': 600 } },
      { id: 'coast-glow', type: 'line', source: 'land', paint: { 'line-color': '#8fe6ff', 'line-opacity': 0.12, 'line-width': 3, 'line-blur': 4 } },
      { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#9fdcf0', 'line-opacity': 0.4, 'line-width': 0.6 } },
      { id: 'study-fill', type: 'fill', source: 'study', paint: { 'fill-color': '#e7c48f', 'fill-opacity': 0.06 } },
      { id: 'study-line', type: 'line', source: 'study', paint: { 'line-color': '#e7c48f', 'line-opacity': 0.7, 'line-width': 1.2, 'line-dasharray': [2, 2] } },
    ],
  }
}

export function regionStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      land: { type: 'geojson', data: '/geo/land-50m-region.json' },
      borders: { type: 'geojson', data: '/geo/borders-50m-region.json' },
      sea: { type: 'geojson', data: '/geo/sea-50m-region.json' },
      grid: { type: 'geojson', data: graticule(5) },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': '#0c0d0e' } },
      { id: 'grid', type: 'line', source: 'grid', paint: { 'line-color': '#8f8a82', 'line-opacity': 0.08, 'line-width': 0.6 } },
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': '#1a1b1d' } },
      { id: 'sea', type: 'fill', source: 'sea', paint: { 'fill-color': '#0c0d0e' } },
      { id: 'sea-grid', type: 'line', source: 'grid', paint: { 'line-color': '#8f8a82', 'line-opacity': 0.07, 'line-width': 0.6 } },
      { id: 'borders', type: 'line', source: 'borders', paint: { 'line-color': '#a8a398', 'line-opacity': 0.22, 'line-width': 0.6, 'line-dasharray': [3, 2] } },
      { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#c4beb2', 'line-opacity': 0.6, 'line-width': 0.8 } },
    ],
  }
}

export const PLACE_LABELS = [
  { name: 'Mediterranean Sea', lon: 18, lat: 35.2, kind: 'sea' },
  { name: 'Black Sea', lon: 34.5, lat: 43.3, kind: 'sea' },
  { name: 'Atlas', lon: -4.5, lat: 32, kind: 'land' },
  { name: 'Alps', lon: 10, lat: 46.3, kind: 'land' },
] as const

export const REGION_CHIP_AT: Record<string, [number, number]> = {
  iberia: [-3.6, 41.9],
  italy_balkans: [15.5, 43.1],
  nile_delta: [30.8, 32.1],
  levant: [37.9, 34.7],
  anatolia: [33.4, 38.3],
  tunisia: [9.0, 31.9],
  sahara_margin: [12.5, 27.3],
}

export function regionChipAt(id: string, bbox: [number, number, number, number] | number[]): [number, number] {
  return REGION_CHIP_AT[id] ?? [(bbox[0] + bbox[1]) / 2, (bbox[2] + bbox[3]) / 2]
}
