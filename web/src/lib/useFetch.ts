import { useEffect, useState } from 'react'

/**
 * Tiny data hook with a shared cache: the same key is fetched once per visit, so going back to a
 * page or switching variables twice is instant. prefetch() warms the cache in the background.
 */
const cache = new Map<string, Promise<unknown>>()

function load<T>(key: string, fn: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined
  if (!p) {
    p = fn()
    cache.set(key, p)
    p.catch(() => cache.delete(key)) // allow a retry after an error
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
    // fn is recreated on each render; the key identifies the request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const current = state.key === key
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: key !== null && (!current || (!state.data && !state.error)),
  }
}
