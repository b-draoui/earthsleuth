import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<unknown>>()

function load<T>(key: string, fn: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined
  if (!p) {
    p = fn()
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return p
}

export function prefetch<T>(key: string, fn: () => Promise<T>): void {
  load(key, fn).catch(() => {})
}

export function useFetch<T>(key: string | null, fn: () => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: Error }>({ key: null })

  useEffect(() => {
    if (!key) return
    let alive = true
    load(key, fn).then(
      (data) => alive && setState({ key, data }),
      (error: Error) => alive && setState({ key, error }),
    )
    return () => {
      alive = false
    }
  }, [key])

  const current = state.key === key
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: key !== null && (!current || (!state.data && !state.error)),
  }
}
