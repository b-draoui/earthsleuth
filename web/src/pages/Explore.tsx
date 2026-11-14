import PageTransition from '../components/PageTransition.tsx'

/**
 * Screens "Trend map" + "Opposite-trend map" + "Time series" (Doc 1, section 12).
 * - Full-screen MapLibre map (STYLE_DARK), one square per cell from api.trends(variable),
 *   colour = slope per decade (lib/colors.ts), dots = significant after FDR.
 * - Toggle to the opposite-trend view (up / down / no change) + regional average chart.
 * - Click a cell -> <SeriesPanel /> slides in.
 */
export default function Explore() {
  return (
    <PageTransition className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-4xl font-bold">Explore</h1>
      <p className="mt-2 text-muted">Under construction.</p>
    </PageTransition>
  )
}
