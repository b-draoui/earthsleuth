import PageTransition from '../components/PageTransition.tsx'

/**
 * Screens "Plan" + "Live progress" (Doc 1, section 12).
 * - The investigation plan in simple words: variables (with definitions), datasets,
 *   region, period, methods. The user can edit it.
 * - Each agent step lights up as it runs: streamAgent() from lib/api.ts.
 * - The answer, each part labelled observed / literature / hypothesis.
 */
export default function Investigate() {
  return (
    <PageTransition className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-4xl font-bold">Investigate</h1>
      <p className="mt-2 text-muted">Under construction.</p>
    </PageTransition>
  )
}
