import { useFetch } from '../lib/useFetch.ts'
import { api } from '../lib/api.ts'

export function useSimulated(): boolean {
  const { data } = useFetch('health', api.health)
  return data?.simulated ?? false
}

export default function SimulatedBadge({ compact = false }: { compact?: boolean }) {
  const simulated = useSimulated()
  if (!simulated) return null
  return (
    <span
      title="The app is reading synthetic data made to build it. Numbers are real statistics on simulated series, not findings about the real Earth."
      className="inline-flex items-center gap-1.5 rounded-full border border-sand/40 bg-sand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sand"
    >
      <span className="size-1.5 rounded-full bg-sand" />
      {compact ? 'Simulated' : 'Simulated data'}
    </span>
  )
}

export function SimulatedNote({ className = '' }: { className?: string }) {
  const simulated = useSimulated()
  if (!simulated) return null
  return (
    <p className={`text-xs leading-relaxed text-sand/80 ${className}`}>
      Simulated data: these numbers are real statistics computed on synthetic series built to develop the app. They
      are not findings about the real Earth. The NASA data replaces them before the final version.
    </p>
  )
}
