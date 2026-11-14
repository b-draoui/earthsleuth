/**
 * The contracts on the front-end side (contracts/README.md).
 * api/schemas.py holds the same shapes in Python. Change both together.
 */

export type VariableId = 't2m' | 'precip' | 'soil_moisture' | 'et' | 'ndvi'

export interface Variable {
  id: VariableId
  label: string
  unit: string
  dataset: string
  version: string
}

/** Contract 2: result for one variable over one region. */
export interface VariableResult {
  variable: VariableId
  unit: string
  region: string
  regional: { slope_per_decade: number; ci95: [number, number]; p: number; significant: boolean }
  cells: { n: number; sig_up: number; sig_down: number; pct_sig_area: number }
  method: string
  datasets: string[]
  run_id: string
}

/** Properties of one cell on the Trend map (one row of trends.parquet). */
export interface TrendCell {
  cell_id: string
  lat: number
  lon: number
  slope_dec: number
  ci_lo: number
  ci_hi: number
  p: number
  q: number
  significant: boolean
  direction: 'up' | 'down' | 'none'
}

export interface Series {
  time: string[]
  value: (number | null)[]
  anomaly: (number | null)[]
}

export type Stage = 'understand' | 'plan' | 'analyse' | 'check' | 'explain'

/** Contract 3: one progress step of the agent. */
export interface AgentEvent {
  stage: Stage
  status: 'running' | 'done' | 'error'
  message: string
  data: Record<string, unknown>
}
