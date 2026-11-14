import type { FeatureCollection } from 'geojson'
import type { AgentEvent, Series, Variable, VariableId, VariableResult } from './types.ts'

/** GET /api/<path> and parse the JSON. Throws with the server's message on error (501 = not built yet). */
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${res.status} on ${path}: ${body.detail ?? res.statusText}`)
  }
  return res.json() as Promise<T>
}

/** One function per FastAPI route (api/routes/). */
export const api = {
  health: () => get<{ status: string; fake_data: boolean }>('/health'),
  variables: () => get<Variable[]>('/variables'),
  trends: (variable: VariableId) => get<FeatureCollection>(`/trends/${variable}`),
  regional: (variable: VariableId) => get<VariableResult>(`/regional/${variable}`),
  series: (variable: VariableId, cellId: string) => get<Series>(`/series/${variable}/${cellId}`),
  ranking: () => get<Record<string, unknown>[]>('/radar/ranking'),
  clusters: () => get<FeatureCollection>('/radar/clusters'),
  graph: () => get<{ nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }>('/graph'),
  demos: () => get<string[]>('/demos'),
}

/**
 * Listen to the agent step by step (Server-Sent Events).
 * path: `/investigate?q=${encodeURIComponent(question)}` or `/demos/${id}`.
 * Returns a function that stops listening (call it when the page unmounts).
 */
export function streamAgent(path: string, onEvent: (event: AgentEvent) => void, onEnd?: () => void): () => void {
  const source = new EventSource(`/api${path}`)
  source.onmessage = (message) => onEvent(JSON.parse(message.data) as AgentEvent)
  source.addEventListener('end', () => {
    source.close()
    onEnd?.()
  })
  source.onerror = () => {
    source.close()
    onEnd?.()
  }
  return () => source.close()
}
