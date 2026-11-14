import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { api } from '../lib/api.ts'

const LINKS = [
  { to: '/investigate', label: 'Investigate' },
  { to: '/explore', label: 'Explore' },
  { to: '/radar', label: 'Signal Radar' },
  { to: '/graph', label: 'Graph' },
  { to: '/report', label: 'Report' },
]

/** Top bar, floating over the page with a blur. The dot shows if the API answers. */
export default function NavBar() {
  const [apiOk, setApiOk] = useState<boolean | null>(null)

  useEffect(() => {
    api.health().then(() => setApiOk(true), () => setApiOk(false))
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-8 border-b border-line/60 bg-space/60 px-6 backdrop-blur-md">
      <NavLink to="/" className="font-display text-lg font-semibold tracking-tight">
        EarthSleuth
      </NavLink>

      <nav className="flex gap-6 text-sm">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? 'text-ink' : 'text-muted transition-colors hover:text-ink')}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <span
        title={apiOk === null ? 'Checking API…' : apiOk ? 'API connected' : 'API not reachable'}
        className={`ml-auto size-2 rounded-full ${apiOk === null ? 'bg-muted' : apiOk ? 'bg-emerald-400' : 'bg-rose-500'}`}
      />
    </header>
  )
}
