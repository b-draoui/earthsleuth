import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import Markdown from '../components/Markdown.tsx'
import PageTransition from '../components/PageTransition.tsx'
import SimulatedBadge from '../components/SimulatedBadge.tsx'
import TopoLines from '../components/TopoLines.tsx'
import VarIcon from '../components/VarIcon.tsx'
import AnswerMap from '../components/investigate/AnswerMap.tsx'
import { api, streamAgent } from '../lib/api.ts'
import { pValue, pct, signed } from '../lib/format.ts'
import { STAGES, type AgentEvent, type Evidence, type Stage, type VariableResult } from '../lib/types.ts'
import { useFetch } from '../lib/useFetch.ts'
import { SCALES, SCALE_OF } from '../lib/colors.ts'
import { VARS, directionWord } from '../lib/variables.ts'

const STAGE_INFO: Record<Stage, { title: string; text: string }> = {
  understand: { title: 'Understand', text: 'What is the question really about?' },
  plan: { title: 'Plan', text: 'Which variables, region, period and tests?' },
  analyse: { title: 'Analyse', text: 'Read the trends from the statistics engine.' },
  check: { title: 'Check', text: 'Every number must match a computed result.' },
  explain: { title: 'Explain', text: 'Say what changed, how sure we are, what we cannot say.' },
}

type Status = 'idle' | 'running' | 'done' | 'error'

export default function Investigate() {
  const [params, setParams] = useSearchParams()
  const [question, setQuestion] = useState(params.get('q') ?? '')
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [asked, setAsked] = useState('')
  const stop = useRef<(() => void) | null>(null)
  const { data: demos } = useFetch('demos', api.demos)
  const { data: regions = [] } = useFetch('regions', api.regions)

  const run = (path: string, label: string) => {
    stop.current?.()
    setEvents([])
    setAsked(label)
    setStatus('running')
    stop.current = streamAgent(
      path,
      (e) => setEvents((prev) => [...prev, e]),
      () => setStatus((s) => (s === 'running' ? 'done' : s)),
    )
  }
  const ask = (q: string) => {
    const text = q.trim()
    if (!text) return
    setParams({ q: text }, { replace: true })
    run(`/investigate?q=${encodeURIComponent(text)}`, text)
  }

  useEffect(() => {
    const q = params.get('q')
    if (q) ask(q)
    return () => stop.current?.()
  }, [])

  const caseId = params.get('case')
  useEffect(() => {
    if (!caseId || !demos) return
    const d = demos.find((x) => x.id === caseId)
    if (!d) return
    setQuestion(d.question)
    run(`/demos/${d.id}`, d.question)
  }, [caseId, demos])

  const derived = useMemo(() => {
    const stage: Record<Stage, { state: 'pending' | 'running' | 'done' | 'error'; messages: string[] }> = {
      understand: { state: 'pending', messages: [] },
      plan: { state: 'pending', messages: [] },
      analyse: { state: 'pending', messages: [] },
      check: { state: 'pending', messages: [] },
      explain: { state: 'pending', messages: [] },
    }
    const results: VariableResult[] = []
    let answer: string | undefined
    let evidence: Evidence[] = []
    let narrator: string | undefined
    let replay: string | undefined
    let error: string | undefined
    for (const e of events) {
      const s = stage[e.stage] ?? stage.explain
      s.state = e.status === 'error' ? 'error' : e.status === 'running' ? 'running' : 'done'
      if (e.status !== 'running' || !s.messages.includes(e.message)) s.messages = [...s.messages.filter((m) => !m.endsWith('…')), e.message]
      if (e.data?.result) results.push(e.data.result)
      if (e.data?.answer_md) answer = e.data.answer_md
      if (e.data?.evidence) evidence = e.data.evidence
      if (e.data?.narrator) narrator = e.data.narrator
      if (e.data?.replay) replay = e.data.replay
      if (e.status === 'error') error = e.message
    }
    const lastIdx = Math.max(-1, ...events.map((e) => STAGES.indexOf(e.stage)))
    STAGES.forEach((st, i) => {
      if (i < lastIdx && stage[st].state === 'running') stage[st].state = 'done'
    })
    return { stage, results, answer, evidence, narrator, replay, error }
  }, [events])

  const started = status !== 'idle'

  return (
    <PageTransition className="relative overflow-hidden pb-24">
      <TopoLines className="opacity-50" seed={9} />
      <div className="relative mx-auto max-w-7xl px-5 pt-28 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">03 · Investigate</p>
          <SimulatedBadge compact />
        </div>
        <motion.h1 layout className={`mt-4 font-semibold ${started ? 'text-3xl md:text-4xl' : 'text-5xl leading-[1.02] md:text-7xl'}`}>
          {started ? (
            <span>
              <span className="text-faint">Case: </span>
              {asked}
            </span>
          ) : (
            <>
              Ask the Earth <span className="text-gradient">a question.</span>
            </>
          )}
        </motion.h1>
        {!started && (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            The investigator turns your question into a plan, reads the trends from the statistics engine, checks every
            number, then tells you what changed, how sure it is, and what the data cannot say.
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            ask(question)
          }}
          className="glass mt-8 flex items-center gap-2 rounded-full p-1.5 pl-6"
        >
          <label htmlFor="q" className="sr-only">
            Your question
          </label>
          <input
            id="q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Is the Maghreb getting hotter and drier?"
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink placeholder:text-faint focus:outline-none md:text-lg"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!question.trim() || status === 'running'}
            className="cta shrink-0 rounded-full bg-space/80 px-6 py-3 font-display text-xs font-semibold tracking-[0.2em] uppercase transition-opacity disabled:opacity-40"
          >
            {status === 'running' ? 'Investigating…' : 'Investigate'}
          </button>
        </form>

        {!started && (
          <div className="mt-10">
            <p className="eyebrow mb-4">Or open a case file</p>
            <div className="grid gap-4 md:grid-cols-3">
              {(demos ?? []).map((d, i) => (
                <motion.button
                  key={d.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.1 }}
                  onClick={() => {
                    setQuestion(d.question)
                    run(`/demos/${d.id}`, d.question)
                  }}
                  className="group glass rounded-2xl p-6 text-left transition-all duration-500 hover:-translate-y-1 hover:border-accent/40"
                >
                  <span className="num text-[11px] tracking-[0.25em] text-accent uppercase">
                    Case {String(i + 1).padStart(2, '0')}
                    {d.recorded && <span className="ml-2 tracking-[0.15em] text-faint">· AI run</span>}
                  </span>
                  <p className="mt-3 font-display text-lg leading-snug font-medium">{d.question}</p>
                  <span className="mt-4 inline-block text-sm text-faint transition-colors group-hover:text-ink">Open the case →</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {started && (
          <div className="mt-10 grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
            <StageTrack stage={derived.stage} />
            <div className="min-w-0">
              {derived.narrator && (
                <p className="mb-5 rounded-xl border border-sand/30 bg-sand/[0.06] px-4 py-2.5 text-xs leading-relaxed text-sand/90">
                  Answered by the {derived.narrator}. Every number still comes from the statistics engine; the AI only
                  changes how the question is read and how the answer is written.
                </p>
              )}
              {derived.replay && (
                <p className="mb-5 rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-2.5 text-xs leading-relaxed text-ink/80">
                  Replay of an investigation {derived.replay}. Ask your own question above to run it live.
                </p>
              )}
              <EvidenceBoard results={derived.results} />
              {derived.answer && derived.results.length > 0 && <AnswerMap results={derived.results} regions={regions} />}
              <AnimatePresence>
                {derived.answer && (
                  <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="glass mt-6 rounded-3xl p-7 md:p-9"
                    aria-label="Findings"
                  >
                    <p className="eyebrow mb-4">Findings</p>
                    <Markdown text={derived.answer} />
                    {derived.evidence.length > 0 && (
                      <div className="mt-7 border-t border-line/60 pt-5">
                        <p className="eyebrow mb-3">Evidence, labelled</p>
                        <ul className="space-y-2">
                          {derived.evidence.map((ev, i) => (
                            <li key={i} className="flex gap-3 text-xs leading-relaxed text-muted">
                              <EvidenceChip kind={ev.kind} />
                              <span>
                                {ev.text} <span className="text-faint">· {ev.source}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-8 flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          setStatus('idle')
                          setEvents([])
                          setQuestion('')
                          setParams({}, { replace: true })
                        }}
                        className="rounded-full border border-line px-5 py-2.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink"
                      >
                        New question
                      </button>
                      <Link to="/understand" className="rounded-full border border-line px-5 py-2.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink">
                        04 · Understand the patterns →
                      </Link>
                      <Link to="/conclude" className="rounded-full border border-line px-5 py-2.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink">
                        05 · Read the report →
                      </Link>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
              {derived.error && (
                <p className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-400/10 p-5 text-sm text-rose-200">
                  The investigation stopped: {derived.error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  )
}

function StageTrack({ stage }: { stage: Record<Stage, { state: string; messages: string[] }> }) {
  return (
    <ol className="relative lg:sticky lg:top-24 lg:self-start" aria-label="Investigation stages">
      <span aria-hidden className="absolute top-4 bottom-4 left-[15px] w-px bg-line" />
      {STAGES.map((st, i) => {
        const s = stage[st]
        const done = s.state === 'done'
        const running = s.state === 'running'
        return (
          <li key={st} className="relative flex gap-4 pb-7 last:pb-0">
            <span className="relative z-10 mt-0.5 grid size-8 shrink-0 place-items-center">
              {running && <span className="pulse-ring absolute inset-0 rounded-full border border-accent" />}
              <span
                className={`grid size-8 place-items-center rounded-full border text-xs transition-all duration-500 ${
                  done
                    ? 'border-accent bg-accent text-space shadow-[0_0_18px_var(--color-accent)]'
                    : running
                      ? 'border-accent bg-abyss text-accent'
                      : s.state === 'error'
                        ? 'border-rose-400 bg-abyss text-rose-300'
                        : 'border-line bg-abyss text-faint'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
            </span>
            <div className="min-w-0 pt-1">
              <p className={`font-display text-base font-medium ${s.state === 'pending' ? 'text-faint' : 'text-ink'}`}>{STAGE_INFO[st].title}</p>
              <p className="text-xs text-faint">{STAGE_INFO[st].text}</p>
              <AnimatePresence initial={false}>
                {s.messages.slice(-2).map((m) => (
                  <motion.p
                    key={m}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-1.5 overflow-hidden text-xs leading-relaxed text-muted"
                  >
                    {m}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function EvidenceBoard({ results }: { results: VariableResult[] }) {
  if (!results.length)
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton h-44 rounded-3xl" />
        ))}
      </div>
    )
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AnimatePresence>
        {results.map((r) => (
          <motion.div
            key={`${r.variable}-${r.region}`}
            layout
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 20 }}
          >
            <InsightCard r={r} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function InsightCard({ r }: { r: VariableResult }) {
  const id = VARS[r.variable]
  const sig = r.regional.significant
  const down = (r.cells.sig_down / Math.max(r.cells.n, 1)) * 100
  const up = (r.cells.sig_up / Math.max(r.cells.n, 1)) * 100
  const regionQuery = r.region !== 'mediterranean_north_africa' ? `&region=${r.region}` : ''
  const scale = SCALES[SCALE_OF[r.variable]]
  return (
    <article className="glass group relative h-full overflow-hidden rounded-3xl p-6">
      <span aria-hidden className="absolute -top-20 -right-20 size-48 rounded-full opacity-25 blur-3xl" style={{ background: id.color }} />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm" style={{ color: id.color }}>
          <VarIcon id={r.variable} size={17} /> {id.short}
        </span>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
            sig ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-faint'
          }`}
        >
          {sig ? 'Significant' : 'Could be chance'}
        </span>
      </div>
      <p className="num relative mt-4 font-display text-4xl font-semibold" style={{ color: sig ? id.color : 'var(--color-muted)' }}>
        {signed(r.regional.slope_per_decade)}
      </p>
      <p className="relative text-xs text-muted">
        {id.perDecade(r.unit)} · {sig ? directionWord(r.variable, r.regional.slope_per_decade) : 'no clear direction'}
      </p>
      <p className="num relative mt-1 text-[11px] text-faint">
        95% range {signed(r.regional.ci95[0])} to {signed(r.regional.ci95[1])} · {pValue(r.regional.p)}
      </p>
      <div className="relative mt-5">
        <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
          <motion.div initial={{ width: 0 }} animate={{ width: `${down}%` }} transition={{ duration: 1, delay: 0.2 }} style={{ background: scale[1] }} />
          <div className="flex-1" />
          <motion.div initial={{ width: 0 }} animate={{ width: `${up}%` }} transition={{ duration: 1, delay: 0.2 }} style={{ background: scale[5] }} />
        </div>
        <p className="num mt-1.5 flex justify-between text-[11px] text-faint">
          <span>{r.cells.sig_down} cells ↓</span>
          <span>{pct(r.cells.pct_sig_area)} of area</span>
          <span>{r.cells.sig_up} ↑</span>
        </p>
      </div>
      <Link to={`/explore?v=${r.variable}${regionQuery}`} className="relative mt-4 inline-block text-xs text-faint transition-colors hover:text-ink">
        See it on the map →
      </Link>
    </article>
  )
}

function EvidenceChip({ kind }: { kind: Evidence['kind'] }) {
  const style =
    kind === 'observed'
      ? 'border-glow/40 text-glow'
      : kind === 'literature'
        ? 'border-accent/40 text-accent'
        : 'border-sand/40 text-sand'
  return <span className={`h-fit shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ${style}`}>{kind}</span>
}
