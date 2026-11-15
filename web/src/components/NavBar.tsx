import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { api } from '../lib/api.ts'
import SimulatedBadge from './SimulatedBadge.tsx'

export const STEPS = [
  { to: '/', label: 'Discover', n: '01' },
  { to: '/explore', label: 'Explore', n: '02' },
  { to: '/investigate', label: 'Investigate', n: '03' },
  { to: '/understand', label: 'Understand', n: '04' },
  { to: '/conclude', label: 'Conclude', n: '05' },
]

export default function NavBar() {
  const { pathname } = useLocation()
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    api.health().then(() => setApiOk(true), () => setApiOk(false))
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const active = STEPS.findIndex((s) => (s.to === '/' ? pathname === '/' : pathname.startsWith(s.to)))

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled || pathname !== '/' ? 'border-b border-line/50 bg-abyss/70 backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-5 md:px-8">
        <NavLink to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="EarthSleuth home">
          <Logo />
          <span className="hidden font-display text-[17px] font-semibold tracking-tight sm:inline">EarthSleuth</span>
        </NavLink>

        <nav aria-label="Investigation steps" className="scroll-thin -mx-2 flex flex-1 justify-start overflow-x-auto px-2 md:justify-center">
          <ol className="flex items-center gap-1 md:gap-2">
            {STEPS.map((s, i) => {
              const isActive = i === active
              return (
                <li key={s.to} className="flex items-center">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={`mx-1 hidden h-px w-5 md:block lg:w-8 ${i <= active ? 'bg-accent/50' : 'bg-line'}`}
                    />
                  )}
                  <NavLink
                    to={s.to}
                    aria-label={`${s.n} ${s.label}`}
                    className={`relative flex items-center gap-2 rounded-[3px] px-3 py-1.5 text-[13px] transition-colors ${
                      isActive ? 'text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-[3px] border border-accent/40 bg-accent/10"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className={`relative num text-[10px] ${isActive ? 'text-accent' : 'text-faint'}`}>{s.n}</span>
                    <span className={`relative whitespace-nowrap ${isActive ? '' : 'hidden md:inline'}`}>{s.label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden sm:block">
            <SimulatedBadge />
          </span>
          <span
            role="status"
            title={apiOk === null ? 'Checking the API…' : apiOk ? 'API connected' : 'API not reachable'}
            className={`size-2 rounded-full ${apiOk === null ? 'bg-faint' : apiOk ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-rose-500'}`}
          />
        </div>
      </div>
    </header>
  )
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden className="transition-transform duration-700 group-hover:rotate-[30deg]">
      <defs>
        <radialGradient id="logo-g" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#8fe6ff" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#1b3a66" />
          <stop offset="100%" stopColor="#17181a" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="10" fill="url(#logo-g)" stroke="#a99bff" strokeOpacity="0.7" />
      <ellipse cx="16" cy="16" rx="15" ry="5.5" fill="none" stroke="#e7c48f" strokeOpacity="0.8" strokeWidth="1.2" transform="rotate(-22 16 16)" />
      <circle cx="26.5" cy="11.5" r="1.6" fill="#e7c48f" />
    </svg>
  )
}
