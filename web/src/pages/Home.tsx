import { motion } from 'motion/react'
import { Link } from 'react-router'
import Globe from '../components/Globe.tsx'
import PageTransition from '../components/PageTransition.tsx'

/**
 * Screen "Home" (Doc 1, section 12): "What do you want to investigate?" box,
 * guided mode button, two demo investigations to watch.
 * TODO(app): question box, guided mode, the two demo buttons (api.demos()).
 */
export default function Home() {
  return (
    <PageTransition className="relative h-screen overflow-hidden">
      <Globe />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-end pb-24 text-center"
      >
        <h1 className="text-6xl font-bold md:text-7xl">EarthSleuth</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">Is the Earth really changing here, or is it just luck?</p>
        <Link
          to="/investigate"
          className="pointer-events-auto mt-8 rounded-full bg-accent px-6 py-3 font-medium text-space transition hover:brightness-110"
        >
          Start investigating
        </Link>
      </motion.div>
    </PageTransition>
  )
}
