/**
 * The contracts on the front-end side (contracts/README.md).
 * api/schemas.py holds the same shapes in Python. Change both together.
 */
import type { FeatureCollection, Polygon } from 'geojson'

export type VariableId = 't2m' | 'precip' | 'soil_moisture' | 'et' | 'ndvi'
export const VARIABLE_IDS: VariableId[] = ['t2m', 'precip', 'soil_moisture', 'et', 'ndvi']

export interface Health {
  status: string
  simulated: boolean
  run_id: string | null
  period: [string, string]
}

export interface Variable {
  id: VariableId
  label: string
  unit: string
  dataset: string
  version: string
  definition: string
  why: string
}

export interface Region {
  id: string
  label: string
  bbox: [number, number, number, number] // lon_min, lon_max, lat_min, lat_max
}

export interface RegionalStats {
  slope_per_decade: number
  ci95: [number, number]
  p: number
  significant: boolean
}

export interface CellCounts {
  n: number
  sig_up: number
  sig_down: number
  pct_sig_area: number
}

/** Contract 2: result for one variable over one region. */
export interface VariableResult {
  variable: VariableId
  unit: string
  region: string
  regional: RegionalStats
  cells: CellCounts
  method: string
  datasets: string[]
  run_id: string
  label?: string
  bbox?: [number, number, number, number]
}

export type Direction = 'up' | 'down' | 'none'

/** Properties of one cell on the map: its trend + its mean anomaly each year (y2001 ... y2024). */
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
  direction: Direction
  [year: `y${number}`]: number | null
}

export interface TrendsMeta {
  variable: VariableId
  unit: string
  years: number[]
  slope_max: number
  anomaly_max: number
  n_cells: number
  n_significant: number
  simulated: boolean
  run_id: string
}

export type TrendsGeoJSON = FeatureCollection<Polygon, TrendCell> & { meta: TrendsMeta }

export interface TrendLines {
  trend: (number | null)[]
  band_lo: (number | null)[]
  band_hi: (number | null)[]
}

export interface CellSeries extends TrendLines {
  variable: VariableId
  cell_id: string
  lat: number
  lon: number
  unit: string
  time: string[]
  value: (number | null)[]
  anomaly: (number | null)[]
  seasonal_cycle: (number | null)[]
  stats: {
    slope_dec: number
    ci_lo: number
    ci_hi: number
    p: number
    q: number
    significant: boolean
    direction: Direction
    n: number
    tau: number
  }
  regions: string[]
}

export interface RegionalSeries extends TrendLines {
  variable: VariableId
  region: string
  label: string
  unit: string
  time: string[]
  value: (number | null)[]
  anomaly: (number | null)[]
  years: number[]
  yearly_anomaly: (number | null)[]
  stats: RegionalStats
}

export interface RankingRow {
  variable: VariableId
  label: string
  unit: string
  pct_up: number
  pct_down: number
  pct_total: number
  n_cells: number
  regional: RegionalStats
}

export interface ClusterSummary {
  cluster: number
  name: string
  n_cells: number
  signature: Record<VariableId, number>
}

export type ClustersGeoJSON = FeatureCollection<Polygon, { cell_id: string; cluster: number; cluster_name: string }> & {
  meta: { clusters: ClusterSummary[]; simulated: boolean }
}

export interface SummaryVariable {
  variable: VariableId
  label: string
  unit: string
  regional: RegionalStats
  cells: CellCounts
  strongest: { region: string; label: string; slope_dec: number; p: number } | null
  opposite: { up: string[]; down: string[] } | null
}

export interface Summary {
  period: [string, string]
  region: string
  region_label: string
  n_land_cells: number
  land_area_km2: number
  variables: SummaryVariable[]
  warming_drying: { n_cells: number; pct_cells: number }
  method: string
  simulated: boolean
  run_id: string
}

/** /api/cells: every land cell with the trend of all five variables, aligned by index. */
export interface CellsVariable {
  unit: string
  slope_max: number
  slope: (number | null)[]
  ci_lo: (number | null)[]
  ci_hi: (number | null)[]
  q: (number | null)[]
  sig: boolean[]
}

export interface CellsMatrix {
  cells: { id: string; lat: number; lon: number }[]
  variables: Record<VariableId, CellsVariable>
  simulated: boolean
  run_id: string
}

export interface GraphNode {
  id: string
  type: string
  label: string
  [key: string]: unknown
}

export interface GraphEdge {
  source: string
  target: string
  type: string
  [key: string]: unknown
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  graph?: Record<string, unknown>
}

export type Stage = 'understand' | 'plan' | 'analyse' | 'check' | 'explain'
export const STAGES: Stage[] = ['understand', 'plan', 'analyse', 'check', 'explain']

export interface Evidence {
  kind: 'observed' | 'literature' | 'hypothesis'
  text: string
  source: string
}

/** Contract 3: one progress step of the agent. */
export interface AgentEvent {
  stage: Stage
  status: 'running' | 'done' | 'error'
  message: string
  data: {
    narrator?: string
    variable?: VariableId
    result?: VariableResult
    answer_md?: string
    evidence?: Evidence[]
    region?: string
    variables?: VariableId[]
    [key: string]: unknown
  }
}

export interface Demo {
  id: string
  question: string
}
