import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { plain, signed } from '../lib/format.ts'
import type { TrendLines } from '../lib/types.ts'

const TICKS = ['2001-01', '2006-01', '2011-01', '2016-01', '2021-01']

export default function SeriesChart({
  time,
  value,
  anomaly,
  lines,
  unit,
  color,
  mode,
  height = 220,
  windows,
  cursor,
}: {
  time: string[]
  value: (number | null)[]
  anomaly: (number | null)[]
  lines: TrendLines
  unit: string
  color: string
  mode: 'anomaly' | 'raw'
  height?: number
  windows?: [string, string, string][]
  cursor?: string | null
}) {
  const data = useMemo(
    () =>
      time.map((t, i) => ({
        t,
        v: mode === 'raw' ? value[i] : anomaly[i],
        tr: mode === 'anomaly' ? lines.trend[i] : null,
        band: mode === 'anomaly' && lines.band_lo[i] !== null ? [lines.band_lo[i], lines.band_hi[i]] : null,
      })),
    [time, value, anomaly, lines, mode],
  )

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#1b2740" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            ticks={TICKS}
            tickFormatter={(t: string) => t.slice(0, 4)}
            tick={{ fill: '#5d6a83', fontSize: 11 }}
            axisLine={{ stroke: '#1b2740' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#5d6a83', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v: number) => plain(v)}
            domain={['auto', 'auto']}
          />
          {windows?.map(([x1, x2, label]) => (
            <ReferenceArea
              key={label}
              x1={x1}
              x2={x2}
              fill="#e7c48f"
              fillOpacity={0.1}
              stroke="#e7c48f"
              strokeOpacity={0.35}
              strokeDasharray="3 3"
              label={{ value: label, position: 'insideTop', fill: '#e7c48f', fontSize: 10 }}
            />
          ))}
          {mode === 'anomaly' && <ReferenceLine y={0} stroke="#3a4a6b" />}
          {cursor && <ReferenceLine x={cursor} stroke="#ffffff" strokeOpacity={0.85} strokeWidth={1.5} ifOverflow="extendDomain" />}
          {mode === 'anomaly' && (
            <Area dataKey="band" stroke="none" fill="#ffe2b8" fillOpacity={0.14} isAnimationActive animationDuration={900} />
          )}
          <Line dataKey="v" stroke={color} strokeWidth={1.1} strokeOpacity={0.75} dot={false} isAnimationActive animationDuration={900} />
          {mode === 'anomaly' && (
            <Line dataKey="tr" stroke="#ffe2b8" strokeWidth={2.4} dot={false} isAnimationActive animationDuration={1300} />
          )}
          <Tooltip
            cursor={{ stroke: '#5d6a83', strokeDasharray: '3 3' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as { v: number | null; tr: number | null }
              return (
                <div className="glass rounded-lg px-3 py-2 text-xs">
                  <p className="num text-faint">{String(label)}</p>
                  <p className="num mt-0.5 text-ink">
                    {mode === 'anomaly' ? `${signed(row.v)} ${unit} vs. usual` : `${plain(row.v)} ${unit}`}
                  </p>
                  {row.tr !== null && <p className="num text-sand/80">trend line {signed(row.tr)}</p>}
                </div>
              )
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
