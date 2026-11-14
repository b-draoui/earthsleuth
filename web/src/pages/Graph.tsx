import PageTransition from '../components/PageTransition.tsx'

/**
 * Screen "Graph explorer" (Doc 1, section 12).
 * Interactive graph (react-force-graph-2d) from api.graph(): click a finding to see its
 * datasets, mechanisms, papers and hypotheses. Hypotheses dashed, marked "unverified".
 */
export default function Graph() {
  return (
    <PageTransition className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-4xl font-bold">Graph explorer</h1>
      <p className="mt-2 text-muted">Under construction.</p>
    </PageTransition>
  )
}
