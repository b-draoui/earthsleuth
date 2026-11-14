import type { VariableId } from './types.ts'

/**
 * Colour-blind safe diverging scales (ColorBrewer), from "decrease" to "increase".
 * Temperature: blue = cooling, red = warming. Water and vegetation: brown = drier, green = wetter.
 * TODO(app): on the dark map, try a dark grey instead of the near-white middle colour.
 */
export const SCALES = {
  temperature: ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'],
  water: ['#8c510a', '#d8b365', '#f6e8c3', '#f5f5f5', '#c7eae5', '#5ab4ac', '#01665e'],
} as const

export const SCALE_OF: Record<VariableId, keyof typeof SCALES> = {
  t2m: 'temperature',
  precip: 'water',
  soil_moisture: 'water',
  et: 'water',
  ndvi: 'water',
}

/** Not significant after FDR. */
export const NOT_SIGNIFICANT = '#3a4458'
