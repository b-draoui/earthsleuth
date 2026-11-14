import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import { CATEGORICAL } from '../../lib/colors.ts'
import type { GraphNode, KnowledgeGraph } from '../../lib/types.ts'

const TYPE_COLOR: Record<string, string> = {
  Mission: CATEGORICAL[4],
  Instrument: CATEGORICAL[1],
  Dataset: CATEGORICAL[1],
  Variable: '#e9eef7',
  Concept: CATEGORICAL[0],
  Region: CATEGORICAL[7],
  Finding: '#a99bff',
  Hypothesis: CATEGORICAL[6],
  Paper: CATEGORICAL[2],
}
const LABELLED = new Set(['Variable', 'Concept', 'Mission'])

type N = GraphNode & { x?: number; y?: number; degree: number }
type L = { source: string | N; target: string | N; type: string; [k: string]: unknown }

/** The knowledge + evidence graph: data sources -> variables -> concepts, and the findings. */
export default function Connections({ graph }: { graph: KnowledgeGraph }) {
  const box = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fg = useRef<ForceGraphMethods<any, any> | undefined>(undefined)
  const fitted = useRef(false)
  const [width, setWidth] = useState(800)
  const [selected, setSelected] = useState<N | null>(null)
  const [hover, setHover] = useState<N | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const data = useMemo(() => {
    const degree = new Map<string, number>()
    for (const e of graph.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
    }
    return {
      nodes: graph.nodes.map((n) => ({ ...n, degree: degree.get(n.id) ?? 0 })) as N[],
      links: graph.edges.map((e) => ({ ...e })) as L[],
    }
  }, [graph])

  const neighbours = useMemo(() => {
    if (!selected) return []
    return graph.edges
      .filter((e) => e.source === selected.id || e.target === selected.id)
      .map((e) => {
        const otherId = e.source === selected.id ? e.target : e.source
        const other = graph.nodes.find((n) => n.id === otherId)
        return { edge: e, other, outgoing: e.source === selected.id }
      })
  }, [selected, graph])

  const focus = hover ?? selected
  const near = useMemo(() => {
    if (!focus) return null
    const s = new Set([focus.id])
    for (const e of graph.edges) {
      if (e.source === focus.id) s.add(e.target)
      if (e.target === focus.id) s.add(e.source)
    }
    return s
  }, [focus, graph])

  const types = [...new Set(graph.nodes.map((n) => n.type))]

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div ref={box} className="glass relative overflow-hidden rounded-3xl" style={{ height: 560 }}>
        <ForceGraph2D
          ref={fg}
          graphData={data}
          onEngineTick={() => {
            const f = fg.current
            if (!f || fitted.current) return
            fitted.current = true
            f.d3Force('charge')?.strength(-140)
            f.d3Force('link')?.distance(46)
          }}
          onEngineStop={() => fg.current?.zoomToFit(600, 50)}
          width={width}
          height={560}
          backgroundColor="rgba(0,0,0,0)"
          nodeId="id"
          cooldownTicks={140}
          d3VelocityDecay={0.3}
          linkColor={(l) => {
            const link = l as L
            const s = typeof link.source === 'object' ? link.source.id : link.source
            const t = typeof link.target === 'object' ? link.target.id : link.target
            const lit = near && near.has(s) && near.has(t)
            if (link.type === 'INFLUENCES') return lit ? 'rgba(231,196,143,0.9)' : 'rgba(231,196,143,0.35)'
            return lit ? 'rgba(169,155,255,0.8)' : near ? 'rgba(120,140,180,0.08)' : 'rgba(120,140,180,0.22)'
          }}
          linkWidth={(l) => ((l as L).type === 'INFLUENCES' ? 1.6 : 0.8)}
          linkDirectionalArrowLength={(l) => ((l as L).type === 'INFLUENCES' ? 5 : 0)}
          linkDirectionalArrowRelPos={0.9}
          linkLineDash={(l) => ((l as L).type === 'INFLUENCES' ? [4, 3] : null)}
          onNodeHover={(n) => setHover((n as N) ?? null)}
          onNodeClick={(n) => setSelected(n as N)}
          onBackgroundClick={() => setSelected(null)}
          nodeCanvasObject={(n, ctx, scale) => {
            const node = n as N
            const r = 3 + Math.sqrt(node.degree) * 1.6
            const dim = near && !near.has(node.id)
            const color = TYPE_COLOR[node.type] ?? '#999'
            ctx.globalAlpha = dim ? 0.15 : 1
            ctx.beginPath()
            ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2)
            ctx.fillStyle = color
            ctx.shadowColor = color
            ctx.shadowBlur = node.id === selected?.id ? 18 : 6
            ctx.fill()
            ctx.shadowBlur = 0
            if (node.type === 'Hypothesis') {
              ctx.setLineDash([2, 2])
              ctx.strokeStyle = '#fff'
              ctx.stroke()
              ctx.setLineDash([])
            }
            const isNear = near?.has(node.id) && node.id !== focus?.id && near.size < 14
            if (LABELLED.has(node.type) || scale > 2.6 || node.id === focus?.id || isNear) {
              const size = Math.max(10 / scale, 2.5)
              ctx.font = `${size}px Inter Variable, sans-serif`
              ctx.fillStyle = dim ? 'rgba(233,238,247,0.2)' : 'rgba(233,238,247,0.85)'
              ctx.textAlign = 'center'
              ctx.fillText(node.label.length > 34 ? `${node.label.slice(0, 32)}…` : node.label, node.x ?? 0, (node.y ?? 0) + r + size + 1)
            }
            ctx.globalAlpha = 1
          }}
          nodePointerAreaPaint={(n, color, ctx) => {
            const node = n as N
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x ?? 0, node.y ?? 0, 3 + Math.sqrt(node.degree) * 1.6 + 2, 0, Math.PI * 2)
            ctx.fill()
          }}
        />
        <ul className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          {types.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: TYPE_COLOR[t] ?? '#999' }} /> {t}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-sand" /> physical link (not tested)
          </li>
        </ul>
      </div>

      <aside className="glass scroll-thin max-h-[560px] overflow-y-auto rounded-3xl p-6">
        {!selected ? (
          <div className="text-sm leading-relaxed text-muted">
            <p className="eyebrow mb-3">How to read it</p>
            <p>Each dot is a piece of knowledge: a satellite or model, a dataset, a variable, an idea, a place, or a finding computed by EarthSleuth.</p>
            <p className="mt-3">Click any dot to see what it is connected to. Drag to rearrange, scroll to zoom.</p>
            <p className="mt-3 text-xs text-faint">
              Dashed gold arrows are general physical relationships (rain wets soils, heat dries them). They are context, not
              results: EarthSleuth does not test causes. The graph holds no scientific papers yet; only papers the team has
              read will be added.
            </p>
          </div>
        ) : (
          <div>
            <p className="eyebrow" style={{ color: TYPE_COLOR[selected.type] }}>
              {selected.type}
            </p>
            <h3 className="mt-2 text-xl font-semibold">{selected.label}</h3>
            {typeof selected.slope_dec === 'number' && (
              <p className="num mt-2 text-sm text-muted">Slope {String((selected.slope_dec as number).toFixed(3))} per decade</p>
            )}
            {selected.simulated === true && <p className="mt-2 text-xs text-sand/80">Computed on simulated data.</p>}
            <p className="eyebrow mt-6 mb-2">Connections ({neighbours.length})</p>
            <ul className="space-y-2">
              {neighbours.map(({ edge, other, outgoing }, i) => (
                <li key={i}>
                  <button
                    onClick={() => other && setSelected(data.nodes.find((n) => n.id === other.id) ?? null)}
                    className="w-full rounded-xl border border-line/60 px-3 py-2 text-left text-xs transition-colors hover:border-accent/40"
                  >
                    <span className="text-faint">
                      {outgoing ? '' : '← '}
                      {edge.type.replaceAll('_', ' ').toLowerCase()}
                      {outgoing ? ' →' : ''}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink">{other?.label ?? edge.target}</span>
                    {typeof edge.basis === 'string' && <span className="mt-0.5 block text-[10px] text-sand/80">{edge.basis}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}
