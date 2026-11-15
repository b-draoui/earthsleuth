import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { plain, signed } from '../../lib/format.ts'

export default function Timeline({
  years,
  year,
  onYear,
  playing,
  onPlaying,
  regional,
  unit,
  color,
}: {
  years: number[]
  year: number
  onYear: (y: number) => void
  playing: boolean
  onPlaying: (p: boolean) => void
  regional?: (number | null)[]
  unit: string
  color: string
}) {
  const yearRef = useRef(year)
  useEffect(() => {
    yearRef.current = year
  }, [year])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      const i = years.indexOf(yearRef.current)
      if (i >= years.length - 1) {
        onPlaying(false)
        return
      }
      onYear(years[i + 1])
    }, 850)
    return () => window.clearInterval(id)
  }, [playing, years, onYear, onPlaying])

  const max = Math.max(...(regional ?? [1]).map((v) => Math.abs(v ?? 0)), 1e-9)
  const idx = years.indexOf(year)
  const value = regional?.[idx] ?? null

  return (
    <div
      className="glass pointer-events-auto w-full rounded-3xl px-5 py-4"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' && idx < years.length - 1) onYear(years[idx + 1])
        if (e.key === 'ArrowLeft' && idx > 0) onYear(years[idx - 1])
      }}
    >
      <div className="flex items-center gap-5">
        <button
          onClick={() => {
            if (!playing && idx === years.length - 1) onYear(years[0])
            onPlaying(!playing)
          }}
          aria-label={playing ? 'Pause' : 'Play the years'}
          className="grid size-12 shrink-0 place-items-center rounded-full border border-accent/50 bg-accent/10 text-accent transition-all hover:scale-105 hover:bg-accent/20"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="1" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9.5-5.5z" /></svg>
          )}
        </button>
        <div className="w-28 shrink-0">
          <motion.p key={year} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="num font-display text-4xl leading-none font-semibold">
            {year}
          </motion.p>
          <p className="num mt-1 text-[11px] text-muted">
            region {value === null ? '–' : `${signed(value)} ${unit}`}
          </p>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="flex h-10 items-center gap-[3px]">
            {years.map((y, i) => {
              const v = regional?.[i] ?? 0
              const h = Math.max(3, (Math.abs(v) / max) * 18)
              return (
                <div key={y} className="flex h-full flex-1 flex-col justify-center">
                  <div
                    className="mx-auto w-full max-w-[10px] rounded-sm transition-opacity"
                    style={{
                      height: h,
                      transform: `translateY(${v >= 0 ? -h / 2 : h / 2}px)`,
                      background: color,
                      opacity: y === year ? 1 : y < year ? 0.55 : 0.2,
                    }}
                    title={`${y}: ${plain(v)} ${unit}`}
                  />
                </div>
              )
            })}
          </div>
          <input
            type="range"
            min={0}
            max={years.length - 1}
            value={Math.max(idx, 0)}
            onChange={(e) => {
              onPlaying(false)
              onYear(years[Number(e.target.value)])
            }}
            aria-label="Year"
            aria-valuetext={String(year)}
            className="mt-1 w-full accent-[var(--color-accent)]"
          />
          <div className="num flex justify-between text-[10px] text-faint">
            <span>{years[0]}</span>
            <span>{years[Math.floor(years.length / 2)]}</span>
            <span>{years[years.length - 1]}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
