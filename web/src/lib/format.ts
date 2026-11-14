/** Number formatting used everywhere, so the same value always reads the same way. */

export function digitsFor(x: number): number {
  const a = Math.abs(x)
  if (a === 0) return 2
  if (a < 0.01) return 4
  if (a < 0.1) return 3
  if (a < 10) return 2
  return 1
}

export function signed(x: number | null | undefined, digits?: number): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '–'
  const d = digits ?? digitsFor(x)
  const s = Math.abs(x).toFixed(d)
  if (Number(s) === 0) return s
  return `${x > 0 ? '+' : '−'}${s}`
}

export function plain(x: number | null | undefined, digits?: number): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '–'
  return x.toFixed(digits ?? digitsFor(x)).replace('-', '−')
}

export function pValue(p: number | null | undefined, name = 'p'): string {
  if (p === null || p === undefined) return `${name} –`
  if (p < 0.001) return `${name} < 0.001`
  return `${name} = ${p.toFixed(3)}`
}

export function pct(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined) return '–'
  return `${x.toFixed(digits)}%`
}

export function bigNumber(x: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(x)
}

export function latLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${ns} · ${Math.abs(lon).toFixed(1)}°${ew}`
}
