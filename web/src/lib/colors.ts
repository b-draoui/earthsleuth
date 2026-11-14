import type { ExpressionSpecification } from 'maplibre-gl'
import type { VariableId } from './types.ts'

/**
 * Colour-blind safe diverging scales (ColorBrewer RdBu and BrBG), "decrease" -> "increase".
 * The middle step is a dark neutral so that on the night map small changes fade into the
 * background and strong signals glow.
 */
export const SCALES = {
  temperature: ['#2166ac', '#4393c3', '#92c5de', '#283246', '#f4a582', '#d6604d', '#b2182b'],
  water: ['#8c510a', '#bf812d', '#dfc27d', '#283246', '#80cdc1', '#35978f', '#01665e'],
} as const

export type ScaleName = keyof typeof SCALES

export const SCALE_OF: Record<VariableId, ScaleName> = {
  t2m: 'temperature',
  precip: 'water',
  soil_moisture: 'water',
  et: 'water',
  ndvi: 'water',
}

/** Not significant / no data on the map. */
export const QUIET = '#1a2335'

/** Okabe–Ito: colour-blind safe categories, for clusters and graph node types. */
export const CATEGORICAL = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#999999']

/** MapLibre expression: a value -> its colour on the 7-step scale, symmetric around 0. */
export function divergingExpression(input: ExpressionSpecification, max: number, scale: ScaleName): ExpressionSpecification {
  const c = SCALES[scale]
  const m = max > 0 ? max : 1
  return [
    'interpolate',
    ['linear'],
    input,
    -m, c[0],
    (-2 * m) / 3, c[1],
    -m / 3, c[2],
    0, c[3],
    m / 3, c[4],
    (2 * m) / 3, c[5],
    m, c[6],
  ] as ExpressionSpecification
}

/** CSS gradient of a scale, for legends. */
export function cssGradient(scale: ScaleName, direction = '90deg'): string {
  return `linear-gradient(${direction}, ${SCALES[scale].join(', ')})`
}
