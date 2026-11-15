import { useState } from 'react'
import { useCells } from '../../lib/cells.ts'
import { latLon, signed } from '../../lib/format.ts'
import { drawPlaceCard, shareOrDownload, type CardRow } from '../../lib/shareCard.ts'
import { VARIABLE_IDS, type VariableId } from '../../lib/types.ts'
import { VARS } from '../../lib/variables.ts'
import VarIcon from '../VarIcon.tsx'

export default function PlaceSignals({
  cellId,
  title,
  current,
  onVariable,
}: {
  cellId: string
  title: string
  current: VariableId
  onVariable?: (v: VariableId) => void
}) {
  const { data: m } = useCells()
  const [busy, setBusy] = useState(false)
  if (!m) return <div className="skeleton mb-5 h-40 rounded-2xl" />
  const i = m.cells.findIndex((c) => c.id === cellId)
  if (i < 0) return null
  const c = m.cells[i]

  const rows = VARIABLE_IDS.map((v) => {
    const x = m.variables[v]
    const s = x.slope[i]
    return { v, s, sig: x.sig[i], unit: x.unit, frac: s === null ? 0 : Math.max(-1, Math.min(1, s / (x.slope_max || 1))) }
  })

  const share = async () => {
    setBusy(true)
    try {
      const card: CardRow[] = rows.map((r) => ({
        label: VARS[r.v].short,
        value: r.s,
        text: `${signed(r.s)} ${VARS[r.v].perDecade(r.unit)}`,
        sig: r.sig,
        frac: r.frac,
        color: VARS[r.v].color,
        up: VARS[r.v].up,
        down: VARS[r.v].down,
      }))
      const blob = await drawPlaceCard({ title, subtitle: `${latLon(c.lat, c.lon)} · change per decade, 2001–2024`, rows: card, simulated: m.simulated })
      await shareOrDownload(blob, `earthsleuth-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}.png`, `${title} · EarthSleuth`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-line/70 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="eyebrow">Five signals here</p>
        <button
          onClick={share}
          disabled={busy}
          className="shrink-0 rounded-full border border-line px-3 py-1 text-[11px] whitespace-nowrap text-muted transition-colors hover:border-accent/50 hover:text-ink disabled:opacity-50"
        >
          {busy ? 'Making…' : 'Share card ↓'}
        </button>
      </div>
      <ul className="space-y-0.5">
        {rows.map((r) => {
          const on = r.v === current
          return (
            <li key={r.v}>
              <button
                onClick={() => onVariable?.(r.v)}
                aria-pressed={on}
                className={`grid w-full grid-cols-[1.25rem_1fr_auto_4.5rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                  on ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <span style={{ color: VARS[r.v].color }}>
                  <VarIcon id={r.v} size={14} />
                </span>
                <span className={on ? 'text-ink' : 'text-muted'}>{VARS[r.v].short}</span>
                <span className="num" style={{ color: r.sig ? VARS[r.v].color : 'var(--color-faint)' }}>
                  {signed(r.s)}
                </span>
                <span className={`text-right text-[10px] ${r.sig ? 'text-accent' : 'text-faint'}`}>{r.sig ? '● real' : '○ chance?'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
