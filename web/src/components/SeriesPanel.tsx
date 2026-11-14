import type { VariableId } from '../lib/types.ts'

/**
 * Screen "Time series" (Doc 1, section 12), as a panel that slides in when a cell is clicked.
 * Raw monthly series, anomalies, Theil–Sen trend line, confidence band, p and q,
 * and "years needed" when not significant.
 *
 * TODO(app): api.series(variable, cellId) -> Recharts (Line + Area for the band),
 * slide in with motion (initial={{ x: 400 }} animate={{ x: 0 }}).
 */
export default function SeriesPanel({ variable, cellId }: { variable: VariableId; cellId: string }) {
  return (
    <aside className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">
      Time series of {variable} for cell {cellId}: under construction.
    </aside>
  )
}
