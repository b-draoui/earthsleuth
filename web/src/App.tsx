import { AnimatePresence } from 'motion/react'
import { Route, Routes, useLocation } from 'react-router'
import NavBar from './components/NavBar.tsx'
import Explore from './pages/Explore.tsx'
import Graph from './pages/Graph.tsx'
import Home from './pages/Home.tsx'
import Investigate from './pages/Investigate.tsx'
import Radar from './pages/Radar.tsx'
import Report from './pages/Report.tsx'

export default function App() {
  const location = useLocation()

  return (
    <>
      <NavBar />
      {/* mode="wait": the old page fades out before the new one fades in */}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/investigate" element={<Investigate />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/radar" element={<Radar />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/report" element={<Report />} />
        </Routes>
      </AnimatePresence>
    </>
  )
}
