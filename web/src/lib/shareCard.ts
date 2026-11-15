export interface CardRow {
  label: string
  value: number | null
  text: string
  sig: boolean
  frac: number
  color: string
  up: string
  down: string
}

const W = 1080
const H = 1350

function resolve(color: string): string {
  const m = color.match(/var\((--[^)]+)\)/)
  if (!m) return color
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#a99bff'
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function drawPlaceCard(opts: { title: string; subtitle: string; rows: CardRow[]; simulated: boolean }): Promise<Blob> {
  await document.fonts.ready
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const display = "'IBM Plex Sans Variable', system-ui, sans-serif"
  const sans = "'IBM Plex Sans Variable', system-ui, sans-serif"

  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0e0f10')
  g.addColorStop(1, '#1a1b1d')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, 700)
  glow.addColorStop(0, 'rgba(231,196,143,0.14)')
  glow.addColorStop(1, 'rgba(231,196,143,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const pad = 80
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#e7c48f'
  ctx.font = `600 26px ${display}`
  ctx.letterSpacing = '8px'
  ctx.fillText('EARTHSLEUTH', pad, 120)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = '#8b97ad'
  ctx.font = `400 26px ${sans}`
  ctx.textAlign = 'right'
  ctx.fillText('2001 → 2024', W - pad, 120)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#eef2fb'
  ctx.font = `600 92px ${display}`
  ctx.fillText(opts.title, pad, 245)
  ctx.fillStyle = '#8b97ad'
  ctx.font = `400 30px ${sans}`
  ctx.fillText(opts.subtitle, pad, 300)

  const top = 370
  const rowH = 150
  opts.rows.forEach((r, i) => {
    const y = top + i * rowH
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    roundRect(ctx, pad - 20, y, W - 2 * pad + 40, rowH - 18, 26)
    ctx.fill()
    const col = resolve(r.color)
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(pad + 12, y + 44, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#eef2fb'
    ctx.font = `500 32px ${sans}`
    ctx.fillText(r.label, pad + 36, y + 55)
    ctx.font = `600 20px ${sans}`
    ctx.letterSpacing = '3px'
    const verdict = r.sig ? 'REAL SIGNAL' : 'COULD BE CHANCE'
    ctx.textAlign = 'right'
    ctx.fillStyle = r.sig ? '#a99bff' : '#5d6a83'
    ctx.fillText(verdict, W - pad, y + 52)
    ctx.letterSpacing = '0px'
    ctx.font = `600 44px ${display}`
    ctx.fillStyle = r.sig ? col : '#8b97ad'
    ctx.textAlign = 'left'
    ctx.fillText(r.text, pad + 36, y + 108)
    const bx = W - pad - 300
    const bw = 300
    const by = y + 92
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    roundRect(ctx, bx, by, bw, 10, 5)
    ctx.fill()
    ctx.fillStyle = '#3a4a6b'
    ctx.fillRect(bx + bw / 2 - 1, by - 8, 2, 26)
    if (r.value !== null) {
      const len = (Math.abs(r.frac) * bw) / 2
      ctx.globalAlpha = r.sig ? 1 : 0.35
      ctx.fillStyle = col
      roundRect(ctx, r.frac >= 0 ? bx + bw / 2 : bx + bw / 2 - len, by, Math.max(len, 4), 10, 5)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ctx.font = `400 18px ${sans}`
    ctx.fillStyle = '#5d6a83'
    ctx.fillText(r.down, bx, by + 40)
    ctx.textAlign = 'right'
    ctx.fillText(r.up, bx + bw, by + 40)
    ctx.textAlign = 'left'
  })

  const fy = top + opts.rows.length * rowH + 30
  ctx.fillStyle = '#8b97ad'
  ctx.font = `400 22px ${sans}`
  ctx.fillText('Change per decade (Theil–Sen). Real signal = passes a Mann–Kendall test,', pad, fy)
  ctx.fillText('false discovery rate 10% across all cells. A 1° cell is about 100 km wide.', pad, fy + 32)
  if (opts.simulated) {
    ctx.fillStyle = 'rgba(231,196,143,0.12)'
    roundRect(ctx, pad - 20, H - 150, W - 2 * pad + 40, 64, 18)
    ctx.fill()
    ctx.fillStyle = '#e7c48f'
    ctx.font = `600 22px ${sans}`
    ctx.fillText('SIMULATED DATA · not a finding about the real Earth', pad, H - 108)
  }
  ctx.fillStyle = '#5d6a83'
  ctx.font = `400 22px ${sans}`
  ctx.fillText('earthsleuth.onrender.com', pad, H - 40)

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('canvas export failed'))), 'image/png'))
}

export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] }) && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ files: [file], title })
      return
    } catch {
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}
