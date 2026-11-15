import { api } from './api.ts'
import type { CellsMatrix, VariableId } from './types.ts'
import { useFetch } from './useFetch.ts'

/** The light all-variables table (/api/cells), shared by every page that needs it. */
export function useCells() {
  return useFetch('cells', api.cells)
}

/** Index of the land cell closest to a point (latitude-corrected), or -1. */
export function nearestLandCell(m: CellsMatrix, lat: number, lon: number): number {
  let best = -1
  let bestD = Infinity
  const k = Math.cos((lat * Math.PI) / 180)
  m.cells.forEach((c, i) => {
    const d = Math.hypot(c.lat - lat, (c.lon - lon) * k)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

/** -1, 0 or +1: the significant direction of one variable at one cell (0 = could be chance). */
export function sigDirection(m: CellsMatrix, v: VariableId, i: number): -1 | 0 | 1 {
  const x = m.variables[v]
  const s = x.slope[i]
  if (!x.sig[i] || s === null || s === 0) return 0
  return s > 0 ? 1 : -1
}

/** Is a cell centre inside a bbox [lon_min, lon_max, lat_min, lat_max]? */
export function inBox(c: { lat: number; lon: number }, bbox?: [number, number, number, number] | null): boolean {
  if (!bbox) return true
  return c.lon >= bbox[0] && c.lon <= bbox[1] && c.lat >= bbox[2] && c.lat <= bbox[3]
}
