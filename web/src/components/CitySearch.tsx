import { useId, useState } from 'react'
import { searchCities, type City } from '../lib/cities.ts'

/** "Find your city": type a few letters, pick a city, the map takes you there. */
export default function CitySearch({
  onPick,
  placeholder = 'Find a city…',
  className = '',
  big = false,
}: {
  onPick: (c: City) => void
  placeholder?: string
  className?: string
  big?: boolean
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const id = useId()
  const hits = searchCities(text)

  const pick = (c: City) => {
    setText('')
    setOpen(false)
    onPick(c)
  }

  return (
    <div className={`relative ${className}`}>
      <div className={`flex items-center gap-2 rounded-full border border-line bg-abyss/70 backdrop-blur focus-within:border-accent/60 ${big ? 'px-5 py-3' : 'px-3.5 py-2'}`}>
        <svg width={big ? 18 : 14} height={big ? 18 : 14} viewBox="0 0 24 24" aria-hidden className="shrink-0 text-faint">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={id}
          aria-autocomplete="list"
          aria-label="Find a city"
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, hits.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && hits[active]) {
              e.preventDefault()
              pick(hits[active])
            } else if (e.key === 'Escape') setOpen(false)
          }}
          className={`min-w-0 flex-1 bg-transparent text-ink placeholder:text-faint focus:outline-none ${big ? 'text-base' : 'text-sm'}`}
        />
      </div>
      {open && hits.length > 0 && (
        <ul id={id} role="listbox" className="glass absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl py-1 text-left">
          {hits.map((c, i) => (
            <li
              key={c.name}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(c)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between px-4 py-2 text-sm ${i === active ? 'bg-white/[0.07] text-ink' : 'text-muted'}`}
            >
              {c.name}
              <span className="num text-[11px] text-faint">
                {c.lat.toFixed(1)}°N · {Math.abs(c.lon).toFixed(1)}°{c.lon < 0 ? 'W' : 'E'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && text.trim().length > 1 && hits.length === 0 && (
        <p className="glass absolute inset-x-0 top-full z-50 mt-1.5 rounded-2xl px-4 py-2.5 text-left text-xs text-muted">
          Not in our list yet. Click the map near it instead.
        </p>
      )}
    </div>
  )
}
