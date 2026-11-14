import { motion } from 'motion/react'
import type { ReactNode } from 'react'

/** Wrap every page in this: fade + slight rise in, fade out. Used with AnimatePresence in App.tsx. */
export default function PageTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`min-h-full pt-14 ${className}`}
    >
      {children}
    </motion.main>
  )
}
