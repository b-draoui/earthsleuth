import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import Footer from '../components/Footer.tsx'
import Flyover from '../components/Flyover.tsx'
import { TourButton } from '../components/DemoTour.tsx'
import Globe from '../components/Globe.tsx'
import PageTransition from '../components/PageTransition.tsx'
import Reveal, { Chapter } from '../components/Reveal.tsx'
import SignalNoise from '../components/SignalNoise.tsx'
import SimulatedBadge from '../components/SimulatedBadge.tsx'
import Starfield from '../components/Starfield.tsx'
import TopoLines from '../components/TopoLines.tsx'
import VarIcon from '../components/VarIcon.tsx'
import { api } from '../lib/api.ts'
import { bigNumber, pct, signed } from '../lib/format.ts'
import type { Summary, Variable } from '../lib/types.ts'
import { useFetch } from '../lib/useFetch.ts'
import { VARS, directionWord } from '../lib/variables.ts'
import { CHALLENGE } from '../lib/credits.ts'

const CHALLENGE_PARTS = [
  { q: 'What is changing?', a: 'Five NASA variables: MERRA-2, GPM IMERG, GLDAS and MODIS.', where: 'Understand', to: '/understand' },
  { q: 'Where?', a: 'Every 1° land cell on the map, and seven sub-regions.', where: 'Explore', to: '/explore' },
  { q: 'How much?', a: 'Change per decade (Theil–Sen slope), with its 95% range.', where: 'Explore', to: '/explore?mode=trend' },
  { q: 'Is it significant?', a: 'Mann–Kendall test with Hamed–Rao correction, false discovery rate 10%.', where: 'The report', to: '/conclude' },
  { q: 'Opposite ways?', a: 'The same variable rising in one region and falling in another.', where: 'Opposites view', to: '/explore?v=precip&mode=opposite' },
]

const LINE_1 = ['The', 'Earth', 'is', 'changing.']
const LINE_2 = ['Can', 'you', 'see', 'the', 'signal?']

export default function Home() {
  const [arrived, setArrived] = useState(false)
  const { data: summary } = useFetch('summary', api.summary)
  const { data: variables } = useFetch('variables', api.variables)

  return (
    <PageTransition className="grain">
      <section className="relative h-[100svh] min-h-[640px] overflow-hidden bg-space" aria-label="Introduction">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_85%,rgba(231,196,143,0.10),transparent_55%),radial-gradient(ellipse_at_15%_10%,rgba(200,194,180,0.05),transparent_50%)]" />
        <Starfield />
        <Globe onArrived={() => setArrived(true)} />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(12,13,14,0.85)_100%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-abyss to-transparent" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1.4 }}
          className="pointer-events-none absolute top-24 left-6 hidden font-display text-[11px] tracking-[0.3em] text-faint uppercase md:block"
        >
          <p>36°N · 15°E</p>
          <p className="mt-1 text-muted">Mediterranean basin</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: arrived ? 1 : 0 }}
          transition={{ duration: 1.2 }}
          className="pointer-events-none absolute top-24 right-6 hidden text-right font-display text-[11px] tracking-[0.3em] text-faint uppercase md:block"
        >
          <p>Study area</p>
          <p className="mt-1 text-sand/80">10°W–40°E · 25°N–47°N</p>
        </motion.div>

        <div className="relative z-10 flex h-full flex-col items-center justify-end px-6 pb-[12vh] text-center">
          <h1 className="font-display text-[clamp(2.4rem,6.2vw,6.2rem)] leading-[0.98] font-semibold tracking-[-0.02em] uppercase">
            <span className="block">
              {LINE_1.map((w, i) => (
                <Word key={i} delay={0.6 + i * 0.12}>
                  {w}
                </Word>
              ))}
            </span>
            <span className="text-gradient block">
              {LINE_2.map((w, i) => (
                <Word key={i} delay={1.3 + i * 0.12}>
                  {w}
                </Word>
              ))}
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2, duration: 1 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg"
          >
            An AI-powered investigation into 24 years of environmental change across the Mediterranean and North Africa.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.6, duration: 1 }}
            className="mt-9 flex flex-col items-center gap-4 sm:flex-row"
          >
            <a
              href="#flyover"
              className="cta group inline-flex items-center gap-3 rounded-[3px] bg-space/70 px-8 py-4 font-display text-sm font-semibold tracking-[0.22em] uppercase backdrop-blur transition-transform hover:scale-[1.03]"
            >
              Begin the investigation
              <span aria-hidden className="transition-transform group-hover:translate-y-0.5">↓</span>
            </a>
            <Link to="/explore" className="text-sm text-muted underline-offset-4 transition-colors hover:text-ink hover:underline">
              or go straight to the map →
            </Link>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.1, duration: 1 }} className="mt-5">
            <TourButton />
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.4 }} className="mt-10 sm:hidden">
            <SimulatedBadge />
          </motion.div>
        </div>
      </section>

      <Flyover />

      <section id="question" className="relative overflow-hidden py-32">
        <TopoLines className="opacity-80" />
        <div className="relative mx-auto max-w-6xl px-6">
          <Chapter n="01" kicker="The question" title={<>Twenty-four years of Earth, one question: <span className="text-gradient">what really changed?</span></>} />
          <Reveal delay={0.1} className="mt-10 max-w-3xl text-lg leading-relaxed text-muted md:text-xl">
            <p>
              From January 2001 to December 2024, satellites and models recorded the climate of the Mediterranean and North
              Africa every month: {summary ? <strong className="text-ink">{bigNumber(summary.land_area_km2)} km²</strong> : 'millions of km²'} of
              land, from the Alps to the Sahara. Somewhere in those numbers are real changes. Most of it is noise.
              EarthSleuth helps you tell the two apart.
            </p>
          </Reveal>
          <Reveal delay={0.2} className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line/70 bg-line/40 md:grid-cols-4">
            <BigStat value="24" label="years, 2001–2024" />
            <BigStat value="288" label="monthly maps per variable" />
            <BigStat value="5" label="environmental variables" />
            <BigStat value={summary ? String(summary.n_land_cells) : '…'} label="land cells of 1°×1°" />
          </Reveal>
          <Reveal delay={0.25} className="glass mt-10 rounded-3xl p-6 md:p-8">
            <p className="eyebrow">The challenge · {CHALLENGE.event}</p>
            <p className="mt-2 font-display text-2xl font-semibold md:text-3xl">{CHALLENGE.title}</p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              Take variables measured by NASA missions or produced by NASA models, show how they change over time, and say
              what is changing, where, how much, and whether the change is significant. Here is where EarthSleuth answers each part.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {CHALLENGE_PARTS.map((c) => (
                <Link key={c.q} to={c.to} className="group rounded-2xl border border-line/70 p-4 transition-colors hover:border-accent/50">
                  <p className="font-display text-base font-medium text-ink">{c.q}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{c.a}</p>
                  <span className="mt-2 inline-block text-xs text-faint transition-colors group-hover:text-ink">{c.where} →</span>
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative py-28">
        <div className="mx-auto max-w-6xl px-6">
          <Chapter n="02" kicker="The witnesses" title="Five measurements, five ways the land tells its story." />
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {(variables ?? []).map((v, i) => (
              <Reveal key={v.id} delay={i * 0.08}>
                <WitnessCard v={v} />
              </Reveal>
            ))}
            {!variables && Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-72 rounded-2xl" />)}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-28">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(255,138,101,0.07),transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <Chapter n="03" kicker="The method" title={<>A trend is a whisper under a <span className="text-v-t2m">storm of seasons</span>.</>} />
          <Reveal delay={0.1} className="mt-14">
            <SignalNoise />
          </Reveal>
        </div>
      </section>

      <section className="relative py-28">
        <div className="mx-auto max-w-6xl px-6">
          <Chapter n="04" kicker="First evidence" title="Three signals worth a closer look." />
          {summary ? <Signals summary={summary} /> : <div className="skeleton mt-14 h-64 rounded-3xl" />}
        </div>
      </section>

      <section className="relative overflow-hidden py-32">
        <TopoLines seed={4} className="opacity-60" />
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <Reveal>
            <p className="eyebrow">Your investigation</p>
            <h2 className="mx-auto mt-5 max-w-3xl text-4xl leading-tight font-semibold md:text-6xl">
              Look. Question. Test. <span className="text-gradient">Conclude.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15} className="mt-14 grid gap-4 text-left md:grid-cols-4">
            {[
              ['02', 'Explore', 'Move through the map, year by year. Click any place to see its full record.', '/explore'],
              ['03', 'Investigate', 'Ask a question. Watch the investigator plan, measure, check and explain.', '/investigate'],
              ['04', 'Understand', 'See which signals are strongest and which changes travel together.', '/understand'],
              ['05', 'Conclude', 'A report of what changed, how sure we are, and what we cannot say.', '/conclude'],
            ].map(([n, title, text, to]) => (
              <Link key={n} to={to} className="group glass rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1 hover:border-accent/40">
                <span className="num text-xs text-accent">{n}</span>
                <p className="mt-3 font-display text-xl font-medium">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                <span className="mt-4 inline-block text-sm text-faint transition-colors group-hover:text-ink">Open →</span>
              </Link>
            ))}
          </Reveal>
          <Reveal delay={0.3} className="mt-16">
            <Link
              to="/explore"
              className="cta inline-flex items-center gap-3 rounded-[3px] bg-space/70 px-9 py-4 font-display text-sm font-semibold tracking-[0.22em] uppercase transition-transform hover:scale-[1.03]"
            >
              Enter the lab <span aria-hidden>→</span>
            </Link>
          </Reveal>
        </div>
      </section>

      <Footer />
    </PageTransition>
  )
}

function Word({ children, delay }: { children: string; delay: number }) {
  return (
    <motion.span
      className="mr-[0.25em] inline-block last:mr-0"
      initial={{ opacity: 0, y: '0.35em', filter: 'blur(12px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ delay, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  )
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-abyss/90 p-6 md:p-8">
      <p className="num font-display text-4xl font-semibold md:text-5xl">{value}</p>
      <p className="mt-2 text-sm text-muted">{label}</p>
    </div>
  )
}

function WitnessCard({ v }: { v: Variable }) {
  const id = VARS[v.id]
  return (
    <Link
      to={`/explore?v=${v.id}`}
      className="group glass relative flex h-full flex-col overflow-hidden rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1.5"
      style={{ ['--c' as string]: id.color }}
    >
      <span
        aria-hidden
        className="absolute -top-16 -right-16 size-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-50"
        style={{ background: id.color }}
      />
      <span className="grid size-11 place-items-center rounded-xl border" style={{ color: id.color, borderColor: `color-mix(in oklab, ${id.color} 40%, transparent)` }}>
        <VarIcon id={v.id} size={22} />
      </span>
      <p className="mt-5 font-display text-lg font-medium">{id.short}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{v.definition}</p>
      <p className="mt-3 text-xs leading-relaxed text-faint">{v.why}</p>
      <p className="mt-auto pt-5 text-[11px] tracking-wider text-faint uppercase">{id.dataset}</p>
      <span aria-hidden className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" style={{ background: id.color }} />
    </Link>
  )
}

function Signals({ summary }: { summary: Summary }) {
  const widest = [...summary.variables].sort((a, b) => b.cells.pct_sig_area - a.cells.pct_sig_area)[0]
  const divided = summary.variables.find((v) => v.opposite)
  const wd = summary.warming_drying
  const cards = [
    widest && {
      v: widest.variable,
      big: pct(widest.cells.pct_sig_area),
      text: `of the land shows a significant local trend in ${VARS[widest.variable].short.toLowerCase()}. Across the whole region: ${signed(widest.regional.slope_per_decade)} ${widest.unit} per decade, mostly ${directionWord(widest.variable, widest.regional.slope_per_decade)}.`,
      to: `/explore?v=${widest.variable}`,
    },
    divided && {
      v: divided.variable,
      big: 'Divided',
      text: `${VARS[divided.variable].short} rises significantly in ${divided.opposite!.up.join(', ')} but falls in ${divided.opposite!.down.join(', ')}. One region, opposite stories.`,
      to: `/explore?v=${divided.variable}&mode=opposite`,
    },
    wd.n_cells > 0 && {
      v: 'soil_moisture' as const,
      big: String(wd.n_cells),
      text: `cells (${wd.pct_cells}% of the land) where the air warmed and the soil dried, both significantly, at the same place.`,
      to: '/understand',
    },
  ].filter(Boolean) as { v: keyof typeof VARS; big: string; text: string; to: string }[]

  return (
    <div className="mt-14 grid gap-5 md:grid-cols-3">
      {cards.map((c, i) => (
        <Reveal key={i} delay={i * 0.12}>
          <Link to={c.to} className="group glass relative flex h-full flex-col overflow-hidden rounded-3xl p-7 transition-all duration-500 hover:-translate-y-1">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${VARS[c.v].color}, transparent)` }} />
            <span className="flex items-center gap-2 text-xs text-muted" style={{ color: VARS[c.v].color }}>
              <VarIcon id={c.v} size={16} /> {VARS[c.v].short}
            </span>
            <p className="num mt-6 font-display text-5xl font-semibold">{c.big}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{c.text}</p>
            <span className="mt-auto pt-6 text-sm text-faint transition-colors group-hover:text-ink">See the evidence →</span>
          </Link>
        </Reveal>
      ))}
      <p className="text-xs text-faint md:col-span-3">
        Significant = passes a Mann–Kendall test after controlling the false discovery rate at 10% across all cells.{' '}
        {summary.simulated && <span className="text-sand/80">Computed on simulated data.</span>}
      </p>
    </div>
  )
}
