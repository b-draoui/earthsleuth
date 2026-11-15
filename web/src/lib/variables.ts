import type { VariableId } from './types.ts'

export interface VariableIdentity {
  id: VariableId
  short: string
  long: string
  color: string
  up: string
  down: string
  perDecade: (unit: string) => string
  dataset: string
}

export const VARS: Record<VariableId, VariableIdentity> = {
  t2m: {
    id: 't2m',
    short: 'Temperature',
    long: 'Air temperature',
    color: 'var(--color-v-t2m)',
    up: 'warming',
    down: 'cooling',
    perDecade: (u) => `${u} / decade`,
    dataset: 'MERRA-2',
  },
  precip: {
    id: 'precip',
    short: 'Rainfall',
    long: 'Precipitation',
    color: 'var(--color-v-precip)',
    up: 'wetter',
    down: 'drier',
    perDecade: (u) => `${u} / decade`,
    dataset: 'GPM IMERG',
  },
  soil_moisture: {
    id: 'soil_moisture',
    short: 'Soil moisture',
    long: 'Soil moisture (0–10 cm)',
    color: 'var(--color-v-soil_moisture)',
    up: 'moister soils',
    down: 'drying soils',
    perDecade: (u) => `${u} / decade`,
    dataset: 'GLDAS Noah',
  },
  et: {
    id: 'et',
    short: 'Evapotranspiration',
    long: 'Evapotranspiration',
    color: 'var(--color-v-et)',
    up: 'more evaporation',
    down: 'less evaporation',
    perDecade: (u) => `${u} / decade`,
    dataset: 'GLDAS Noah',
  },
  ndvi: {
    id: 'ndvi',
    short: 'Vegetation',
    long: 'Vegetation (NDVI)',
    color: 'var(--color-v-ndvi)',
    up: 'greening',
    down: 'browning',
    perDecade: () => 'NDVI / decade',
    dataset: 'MODIS',
  },
}

export function directionWord(variable: VariableId, value: number): string {
  return value > 0 ? VARS[variable].up : VARS[variable].down
}
