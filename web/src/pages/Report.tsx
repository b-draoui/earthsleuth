import PageTransition from '../components/PageTransition.tsx'

/**
 * Screen "Report" (Doc 1, section 12).
 * Downloadable report: question, method, results, maps, uncertainty,
 * provenance (run_id, dataset versions), references. Markdown is enough.
 */
export default function Report() {
  return (
    <PageTransition className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-4xl font-bold">Report</h1>
      <p className="mt-2 text-muted">Under construction.</p>
    </PageTransition>
  )
}
