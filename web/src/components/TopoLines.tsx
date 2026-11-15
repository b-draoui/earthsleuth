export default function TopoLines({ className = '', lines = 14, seed = 1 }: { className?: string; lines?: number; seed?: number }) {
  const paths: string[] = []
  for (let i = 0; i < lines; i++) {
    const base = 40 + i * (520 / lines)
    let d = ''
    for (let x = 0; x <= 1200; x += 20) {
      const y =
        base +
        28 * Math.sin((x / 1200) * Math.PI * 2 * 1.3 + i * 0.35 + seed) +
        16 * Math.sin((x / 1200) * Math.PI * 2 * 3.1 + i * 0.9 + seed * 2) +
        8 * Math.cos((x / 1200) * Math.PI * 2 * 5.7 + i * 1.7)
      d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)} `
    }
    paths.push(d)
  }
  return (
    <svg aria-hidden viewBox="0 0 1200 600" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#8fe6ff" strokeOpacity={i % 4 === 0 ? 0.09 : 0.045} strokeWidth={i % 4 === 0 ? 1.1 : 0.8} />
      ))}
    </svg>
  )
}
