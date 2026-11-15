import type { ReactNode } from 'react'

/** Small, safe Markdown renderer for agent answers: headings, bullets, quotes, **bold**, *italic*,
 * `code`, and the evidence labels [observed] / [literature] / [hypothesis] as small tags. */
const LABEL: Record<string, string> = {
  observed: 'border-accent/40 text-accent',
  literature: 'border-sand/40 text-sand',
  hypothesis: 'border-dashed border-[#f0a3c6]/60 text-[#f0a3c6]',
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[(?:observed|literature|hypothesis)\])/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('[')) {
      const kind = token.slice(1, -1)
      out.push(
        <span key={i++} className={`mx-0.5 inline-block rounded border px-1 py-px align-[1px] text-[9px] font-semibold tracking-[0.12em] uppercase ${LABEL[kind]}`}>
          {kind}
        </span>,
      )
      last = m.index + token.length
      continue
    }
    if (token.startsWith('`')) {
      out.push(<span key={i++}>{token.slice(1, -1)}</span>)
      last = m.index + token.length
      continue
    }
    out.push(
      token.startsWith('**') ? (
        <strong key={i++} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>
      ) : (
        <em key={i++} className="text-sand/90 not-italic">
          {token.slice(1, -1)}
        </em>
      ),
    )
    last = m.index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.split('\n')
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="my-3 space-y-2.5">
          {list.map((item, j) => (
            <li key={j} className="flex gap-3 leading-relaxed text-muted">
              <span aria-hidden className="mt-[0.6em] size-1 shrink-0 rounded-full bg-glow/70" />
              <span>{inline(item)}</span>
            </li>
          ))}
        </ul>,
      )
      list = []
    }
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (item) {
      list.push(item[1])
      continue
    }
    flush()
    const heading = line.match(/^#{1,4}\s+(.*)$/)
    if (heading) {
      blocks.push(
        <h3 key={blocks.length} className="mt-6 mb-1 text-lg font-semibold text-ink first:mt-0">
          {inline(heading[1].replace(/\*\*/g, ''))}
        </h3>,
      )
    } else if (line.startsWith('> ')) {
      blocks.push(
        <blockquote key={blocks.length} className="my-4 border-l-2 border-sand/60 pl-4 text-sm text-sand/90">
          {inline(line.slice(2))}
        </blockquote>,
      )
    } else if (line.trim()) {
      blocks.push(
        <p key={blocks.length} className="my-2 leading-relaxed text-muted">
          {inline(line)}
        </p>,
      )
    }
  }
  flush()
  return <div>{blocks}</div>
}
