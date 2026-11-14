import PageTransition from '../components/PageTransition.tsx'

/**
 * Screen "Signal Radar" (Doc 1, section 12).
 * Ranked list of discoveries with small maps (api.ranking()), and the clusters with
 * their signatures, e.g. "warming + drying" (api.clusters()).
 */
export default function Radar() {
  return (
    <PageTransition className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-4xl font-bold">Signal Radar</h1>
      <p className="mt-2 text-muted">Under construction.</p>
    </PageTransition>
  )
}
