import { Link } from 'react-router'
import { SimulatedNote } from './SimulatedBadge.tsx'

export default function Footer() {
  return (
    <footer className="relative border-t border-line/60 bg-space/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold">EarthSleuth</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            An investigation into 24 years of environmental change across the Mediterranean and North Africa. Built for the
            NASA Space Apps Challenge 2026.
          </p>
          <SimulatedNote className="mt-4" />
        </div>
        <div className="text-sm text-muted">
          <p className="eyebrow mb-3">Data</p>
          <ul className="space-y-1.5">
            <li>MERRA-2 · M2TMNXSLV v5.12.4 (air temperature)</li>
            <li>GPM IMERG · GPM_3IMERGM v07 (rainfall)</li>
            <li>GLDAS Noah · GLDAS_NOAH025_M v2.1 (soil, evapotranspiration)</li>
            <li>Terra MODIS · MOD13C2 v061 (vegetation)</li>
            <li>Natural Earth (basemap, public domain)</li>
            <li>Globe imagery: Blue Marble, NASA GIBS / ESDIS</li>
          </ul>
        </div>
        <div className="text-sm text-muted">
          <p className="eyebrow mb-3">How it was made</p>
          <p className="leading-relaxed">
            Trends: monthly anomalies, Theil–Sen slope, Mann–Kendall test with Hamed–Rao correction, false discovery rate
            controlled at 10%. AI is used to plan investigations and write explanations; every number it quotes comes from
            the statistics engine.
          </p>
          <p className="mt-3 text-xs text-faint">
            Not affiliated with or endorsed by NASA. <Link to="/conclude" className="underline-offset-4 hover:underline">Method and provenance</Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
