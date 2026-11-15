import { motion } from 'motion/react'

export default function SignalGauge({ value, threshold = 0.1, label = 'q' }: { value: number; threshold?: number; label?: string }) {
  const lo = Math.log10(0.0001)
  const hi = 0
  const pos = (v: number) => (Math.min(Math.max(Math.log10(Math.max(v, 0.0001)), lo), hi) - lo) / (hi - lo)
  const x = pos(value)
  const t = pos(threshold)
  const signal = value < threshold
  return (
    <div>
      <div className="relative h-2.5 rounded-[3px] bg-gradient-to-r from-accent/70 via-accent/25 to-white/5">
        <div className="absolute inset-y-[-4px] w-px bg-sand/80" style={{ left: `${t * 100}%` }} />
        <motion.div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-abyss"
          style={{ background: signal ? 'var(--color-accent)' : 'var(--color-muted)', boxShadow: signal ? '0 0 16px var(--color-accent)' : 'none' }}
          initial={{ left: '100%' }}
          animate={{ left: `${x * 100}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 16 }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] tracking-wider text-faint uppercase">
        <span>Strong signal</span>
        <span className="text-sand/80">
          {label} = {threshold}
        </span>
        <span>Could be chance</span>
      </div>
    </div>
  )
}
