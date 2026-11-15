import type {
  AgentEvent,
  CellSeries,
  CellsMatrix,
  ClustersGeoJSON,
  Demo,
  Health,
  KnowledgeGraph,
  RankingRow,
  Region,
  RegionalSeries,
  Summary,
  TrendsGeoJSON,
  Variable,
  VariableId,
  VariableResult,
} from './types.ts'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${res.status} on ${path}: ${body.detail ?? res.statusText}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => get<Health>('/health'),
  variables: () => get<Variable[]>('/variables'),
  regions: () => get<Region[]>('/regions'),
  trends: (variable: VariableId) => get<TrendsGeoJSON>(`/trends/${variable}`),
  regional: (variable: VariableId, region?: string) =>
    get<VariableResult>(`/regional/${variable}${region ? `?region=${region}` : ''}`),
  regionalAll: (variable: VariableId) => get<VariableResult[]>(`/regional/${variable}/all`),
  regionalSeries: (variable: VariableId, region: string) =>
    get<RegionalSeries>(`/regional/${variable}/series?region=${region}`),
  series: (variable: VariableId, cellId: string) => get<CellSeries>(`/series/${variable}/${cellId}`),
  ranking: () => get<RankingRow[]>('/radar/ranking'),
  clusters: () => get<ClustersGeoJSON>('/radar/clusters'),
  summary: () => get<Summary>('/summary'),
  cells: () => get<CellsMatrix>('/cells'),
  graph: () => get<KnowledgeGraph>('/graph'),
  demos: () => get<Demo[]>('/demos'),
}

export function streamAgent(path: string, onEvent: (event: AgentEvent) => void, onEnd?: () => void): () => void {
  const source = new EventSource(`/api${path}`)
  let ended = false
  const finish = () => {
    if (ended) return
    ended = true
    source.close()
    onEnd?.()
  }
  source.onmessage = (message) => onEvent(JSON.parse(message.data) as AgentEvent)
  source.addEventListener('end', finish)
  source.onerror = finish
  return () => {
    ended = true
    source.close()
  }
}
