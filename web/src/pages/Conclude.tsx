import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import Footer from '../components/Footer.tsx'
import PageTransition from '../components/PageTransition.tsx'
import Reveal from '../components/Reveal.tsx'
import SimulatedBadge from '../components/SimulatedBadge.tsx'
import TopoLines from '../components/TopoLines.tsx'
import { ChangeMaps, TogetherMap } from '../components/conclude/ChangeMaps.tsx'
import { api } from '../lib/api.ts'
import { bigNumber, pValue, pct, signed } from '../lib/format.ts'
import type { Summary, Variable } from '../lib/types.ts'
import { useFetch } from '../lib/useFetch.ts'
import { AI_USE, CHALLENGE, DATA, DESIGN, MAPS, METHODS, SOFTWARE, creditsMarkdown } from '../lib/credits.ts'
import { VARS, directionWord } from '../lib/variables.ts'

function sentence(v: Summary['variables'][number]): string {
  const id = VARS[v.variable]
  const r = v.regional
  const head = r.significant
    ? `${id.long} changed by ${signed(r.slope_per_decade)} ${id.perDecade(v.unit)} on average (${directionWord(v.variable, r.slope_per_decade)}), a statistically significant trend (${pValue(r.p)}).`
    : `${id.long} shows no significant trend over the region as a whole (${signed(r.slope_per_decade)} ${id.perDecade(v.unit)}, ${pValue(r.p)}).`
  const local = ` Locally, ${pct(v.cells.pct_sig_area)} of the land has a significant trend (${v.cells.sig_up} cells up, ${v.cells.sig_down} down).`
  const strong = v.strongest ? ` Strongest regional change: ${v.strongest.label}, ${signed(v.strongest.slope_dec)} per decade.` : ''
  const opp = v.opposite ? ` It goes opposite ways: up in ${v.opposite.up.join(', ')}, down in ${v.opposite.down.join(', ')}.` : ''
  return head + local + strong + opp
}

function toMarkdown(s: Summary, vars: Variable[]): string {
  const lines = [
    `# EarthSleuth report: ${s.region_label}, ${s.period[0]} to ${s.period[1]}`,
    '',
    s.simulated ? '> SIMULATED DATA: numbers are real statistics on synthetic series built to develop the app. They are not findings about the real Earth.' : '',
    '',
    '## What changed',
    ...s.variables.map((v) => `- ${sentence(v)}`),
    '',
    '## Where things change together',
    `- ${s.warming_drying.n_cells} cells (${s.warming_drying.pct_cells}% of the land) have both a significant warming trend and a significant drying of soils.`,
    '',
    '## How sure are we',
    `- Method: ${s.method}.`,
    '- A trend is called significant when the Mann–Kendall test (with Hamed–Rao correction for autocorrelation) passes after controlling the false discovery rate at 10% across all cells; regional averages use p < 0.05.',
    '- The 95% interval of each slope is given; a wide interval means an uncertain rate even when the direction is clear.',
    '',
    '## What we cannot say',
    '- Trends show where and how much things changed, not why. Two variables changing at the same place is correlation, not cause.',
    '- 24 years is short for climate: some real changes are too small to detect yet, and some significant trends may partly reflect natural variability.',
    '',
    '## Provenance',
    ...vars.map((v) => `- ${v.label}: ${v.dataset} v${v.version} (${v.unit})`),
    `- Study area: ${s.region_label}, ${s.n_land_cells} land cells of 1°, ${bigNumber(s.land_area_km2)} km².`,
    `- Run: ${s.run_id}`,
    '',
    ...creditsMarkdown(),
  ]
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n')
}

/** 05 · Conclude: the report. What changed, how sure we are, what we cannot say, where it comes from. */
export default function Conclude() {
  const { data: s } = useFetch('summary', api.summary)
  const { data: vars } = useFetch('variables', api.variables)
  const { hash } = useLocation()

  // links to /conclude#credits (footer) land on the credits
  useEffect(() => {
    if (hash !== '#credits') return
    const t = window.setTimeout(() => document.getElementById('credits')?.scrollIntoView({ behavior: 'smooth' }), 700)
    return () => window.clearTimeout(t)
  }, [hash, s])

  const download = () => {
    if (!s || !vars) return
    const blob = new Blob([toMarkdown(s, vars)], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `earthsleuth-report-${s.run_id.slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageTransition className="relative">
      <section className="relative overflow-hidden pt-32 pb-20">
        <TopoLines className="opacity-50" seed={6} />
        <div className="relative mx-auto max-w-4xl px-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="eyebrow">05 · Conclude</p>
            <SimulatedBadge compact />
          </div>
          <h1 className="mt-6 text-5xl leading-[1.02] font-semibold md:text-7xl">
            The case, <span className="text-gradient">on the record.</span>
          </h1>
          {s && (
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
              {s.region_label}, {s.period[0].slice(0, 4)}–{s.period[1].slice(0, 4)}. {s.n_land_cells} land cells, five
              variables, {s.n_land_cells * 5} trends tested, each with its uncertainty.
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={download}
              disabled={!s || !vars}
              className="cta rounded-full bg-space/80 px-7 py-3.5 font-display text-xs font-semibold tracking-[0.2em] uppercase disabled:opacity-40"
            >
              Download the report (.md)
            </button>
            <button onClick={() => window.print()} className="rounded-full border border-line px-6 py-3 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink">
              Print / save as PDF
            </button>
          </div>
        </div>
      </section>

      {!s && <div className="skeleton mx-auto h-96 max-w-4xl rounded-3xl" />}
      {s && (
        <article className="mx-auto max-w-4xl px-6 pb-24">
          {s.simulated && (
            <Reveal className="mb-12 rounded-2xl border border-sand/40 bg-sand/[0.06] p-5 text-sm leading-relaxed text-sand/90">
              <strong>Simulated data.</strong> Every number on this page is a real statistic computed on synthetic series
              built to develop EarthSleuth. None of it is a finding about the real Earth. The NASA data replaces it before
              the final version, with no change to the method.
            </Reveal>
          )}

          <Section n="I" title="What changed">
            <ChangeMaps s={s} sentence={sentence} />
          </Section>

          <Section n="II" title="Where things change together">
            <TogetherMap s={s} />
            <p className="mt-5 leading-relaxed text-muted">
              In <strong className="text-ink">{s.warming_drying.n_cells} cells</strong> ({s.warming_drying.pct_cells}% of the
              land), the air warmed and the soil dried, both significantly, at the same place.{' '}
              <Link to="/understand" className="text-accent underline-offset-4 hover:underline">
                See the groups of places that change alike →
              </Link>
            </p>
          </Section>

          <Section n="III" title="How sure are we">
            <ul className="space-y-3 leading-relaxed text-muted">
              <li>
                Seasons are removed first (monthly anomalies), then a Theil–Sen line measures the trend. One extreme year barely
                moves it.
              </li>
              <li>
                A Mann–Kendall test, corrected for month-to-month memory (Hamed–Rao), asks whether such a trend could appear by
                chance. Because {s.n_land_cells} cells are tested at once, the false discovery rate is held at 10%.
              </li>
              <li>Every slope comes with its 95% interval. A wide interval means the rate is uncertain, even if the direction is clear.</li>
            </ul>
          </Section>

          <Section n="IV" title="What we cannot say">
            <ul className="space-y-3 leading-relaxed text-muted">
              <li>
                <strong className="text-ink">Why.</strong> Trends show where and how much, not the cause. Two variables changing
                together is correlation.
              </li>
              <li>
                <strong className="text-ink">The far future.</strong> 24 years is short in climate terms; some real changes are
                still too small to detect, and part of a trend may be natural variability.
              </li>
              <li>
                <strong className="text-ink">Very local detail.</strong> Each cell is about 100 km wide: a valley or a city
                inside it is averaged away.
              </li>
            </ul>
          </Section>

          <Section n="V" title="Provenance">
            <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
              {(vars ?? []).map((v) => (
                <div key={v.id} className="flex justify-between gap-4 border-b border-line/50 pb-2">
                  <dt className="text-muted">{v.label}</dt>
                  <dd className="num text-right text-ink">
                    {v.dataset} v{v.version}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-b border-line/50 pb-2">
                <dt className="text-muted">Study area</dt>
                <dd className="num text-right text-ink">{bigNumber(s.land_area_km2)} km² of land</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-line/50 pb-2">
                <dt className="text-muted">Run</dt>
                <dd className="num text-right text-ink">{s.run_id}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-faint">Method string: {s.method}</p>
          </Section>

          <Credits />

          <div className="mt-20 flex flex-wrap justify-center gap-4">
            <Link to="/explore" className="rounded-full border border-line px-6 py-3 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink">
              Back to the map
            </Link>
            <Link to="/investigate" className="cta rounded-full bg-space/80 px-7 py-3 font-display text-xs font-semibold tracking-[0.2em] uppercase">
              Ask another question
            </Link>
          </div>
        </article>
      )}
      <Footer />
    </PageTransition>
  )
}

function Credits() {
  const h = 'mt-6 mb-2 text-xs font-semibold tracking-[0.18em] text-faint uppercase'
  return (
    <Section n="VI" title="Credits and use of AI" id="credits">
      <div className="text-sm leading-relaxed text-muted">
        <p>
          Built for the {CHALLENGE.event}, challenge <strong className="text-ink">“{CHALLENGE.title}”</strong>.
        </p>
        <p className={h}>Data (NASA)</p>
        <ul className="space-y-1.5">
          {DATA.map((d) => (
            <li key={d.doi}>
              {d.name}. {d.by}.{' '}
              <a href={`https://doi.org/${d.doi}`} target="_blank" rel="noreferrer" className="num text-accent underline-offset-4 hover:underline">
                doi:{d.doi}
              </a>
            </li>
          ))}
        </ul>
        <p className={h}>Maps and imagery</p>
        <ul className="space-y-1.5">{MAPS.map((m) => <li key={m}>{m}</li>)}</ul>
        <p className={h}>Methods</p>
        <ul className="space-y-1.5">{METHODS.map((m) => <li key={m}>{m}</li>)}</ul>
        <p className={h}>Fonts and colours</p>
        <ul className="space-y-1.5">{DESIGN.map((m) => <li key={m}>{m}</li>)}</ul>
        <p className={h}>Open-source software</p>
        <ul className="space-y-1.5">
          {SOFTWARE.map((g) => (
            <li key={g.group}>
              <span className="text-ink">{g.group}:</span> {g.items.map(([n, l]) => `${n} (${l})`).join(', ')}
            </li>
          ))}
        </ul>
        <p className={h}>Use of AI</p>
        <p>{AI_USE}</p>
      </div>
    </Section>
  )
}

function Section({ n, title, children, id }: { n: string; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-16 scroll-mt-24 first:mt-0">
      <Reveal>
        <div className="mb-6 flex items-baseline gap-4">
          <span className="num font-display text-sm text-accent">{n}</span>
          <h2 className="text-3xl font-semibold">{title}</h2>
        </div>
      </Reveal>
      <Reveal delay={0.05}>{children}</Reveal>
    </section>
  )
}
