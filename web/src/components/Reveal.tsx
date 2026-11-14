import { motion } from 'motion/react'
import type { ReactNode } from 'react'

/** Fades and lifts its content in the first time it scrolls into view. */
export default function Reveal({
  children,
  delay = 0,
  className = '',
  y = 24,
}: {
  children: ReactNode
  delay?: number
  className?: string
  y?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function Chapter({ n, title, kicker }: { n: string; title: ReactNode; kicker?: string }) {
  return (
    <Reveal>
      <div className="mb-10 flex items-center gap-4">
        <span className="num font-display text-sm text-accent">{n}</span>
        <span className="hairline w-16" />
        {kicker && <span className="eyebrow">{kicker}</span>}
      </div>
      <h2 className="max-w-3xl text-4xl leading-[1.05] font-semibold md:text-6xl">{title}</h2>
    </Reveal>
  )
}
