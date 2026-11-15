import { AnimatePresence } from 'motion/react'
import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import NavBar from './components/NavBar.tsx'
import { TourProvider } from './components/DemoTour.tsx'
import Home from './pages/Home.tsx'

const Explore = lazy(() => import('./pages/Explore.tsx'))
const Investigate = lazy(() => import('./pages/Investigate.tsx'))
const Understand = lazy(() => import('./pages/Understand.tsx'))
const Conclude = lazy(() => import('./pages/Conclude.tsx'))

export default function App() {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0 })
  }, [location.pathname, location.hash])

  return (
    <TourProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded focus:bg-panel focus:px-3 focus:py-2">
        Skip to content
      </a>
      <NavBar />
      <div id="main">
        <Suspense fallback={<PageLoading />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/investigate" element={<Investigate />} />
              <Route path="/understand" element={<Understand />} />
              <Route path="/conclude" element={<Conclude />} />
              <Route path="/radar" element={<Navigate to="/understand" replace />} />
              <Route path="/graph" element={<Navigate to="/understand#connections" replace />} />
              <Route path="/report" element={<Navigate to="/conclude" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
    </TourProvider>
  )
}

function PageLoading() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="relative size-10">
        <span className="pulse-ring absolute inset-0 rounded-full border border-accent/60" />
        <span className="absolute inset-3 rounded-full bg-accent/70" />
      </div>
    </div>
  )
}
