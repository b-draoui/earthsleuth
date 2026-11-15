import { SCALES, type ScaleName } from '../../lib/colors.ts'
import { plain } from '../../lib/format.ts'

export type LegendHover = { lo: number; hi: number } | { direction: 'up' | 'down' | 'none' } | null

export default function Legend({
  mode,
  scale,
  max,
  unit,
  words,
  onHover,
}: {
  mode: 'trend' | 'year' | 'opposite'
  scale: ScaleName
  max: number
  unit: string
  words: [string, string]
  onHover: (h: LegendHover) => void
}) {
  const colors = SCALES[scale]
  if (mode === 'opposite') {
    const items = [
      { direction: 'down' as const, color: colors[1], label: `Significant: ${words[0]}` },
      { direction: 'up' as const, color: colors[5], label: `Significant: ${words[1]}` },
      { direction: 'none' as const, color: '#222325', label: 'No significant change' },
    ]
    return (
      <ul className="space-y-1.5" onMouseLeave={() => onHover(null)}>
        {items.map((it) => (
          <li key={it.direction}>
            <button
              onMouseEnter={() => onHover({ direction: it.direction })}
              onFocus={() => onHover({ direction: it.direction })}
              onBlur={() => onHover(null)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              <span className="size-3.5 rounded-[4px] border border-white/10" style={{ background: it.color }} />
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    )
  }

  const step = max / 3
  const bins = colors.map((c, i) => {
    const centre = (i - 3) * step
    return { c, lo: i === 0 ? -Infinity : centre - step / 2, hi: i === 6 ? Infinity : centre + step / 2 }
  })
  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-[3px]" onMouseLeave={() => onHover(null)}>
        {bins.map((b, i) => (
          <button
            key={i}
            aria-label={`Show cells between ${plain(b.lo)} and ${plain(b.hi)} ${unit}`}
            onMouseEnter={() => onHover({ lo: b.lo, hi: b.hi })}
            onFocus={() => onHover({ lo: b.lo, hi: b.hi })}
            onBlur={() => onHover(null)}
            className="h-full flex-1 transition-transform hover:scale-y-150"
            style={{ background: b.c }}
          />
        ))}
      </div>
      <div className="num mt-1.5 flex justify-between text-[10px] text-faint">
        <span>−{plain(max)}</span>
        <span>0</span>
        <span>+{plain(max)}</span>
      </div>
      <div className="mt-0.5 flex justify-between text-[11px] text-muted">
        <span>← {words[0]}</span>
        <span>{words[1]} →</span>
      </div>
      <p className="mt-1 text-[10px] text-faint">{mode === 'trend' ? `${unit} per decade` : `${unit} vs. the 2001–2024 average`}</p>
    </div>
  )
}
