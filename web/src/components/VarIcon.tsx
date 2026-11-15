import type { VariableId } from '../lib/types.ts'

export default function VarIcon({ id, size = 20, className = '' }: { id: VariableId; size?: number; className?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }
  switch (id) {
    case 't2m':
      return (
        <svg {...common}>
          <path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0Z" />
          <path d="M12 9v7" />
          <path d="M17.5 5.5h2M17.5 8.5h1.5M17.5 11.5h2" opacity="0.6" />
        </svg>
      )
    case 'precip':
      return (
        <svg {...common}>
          <path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10Z" />
          <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" opacity="0.6" />
        </svg>
      )
    case 'soil_moisture':
      return (
        <svg {...common}>
          <path d="M3 9h18" />
          <path d="M3 14c2 0 2 1 4 1s2-1 4-1 2 1 4 1 2-1 4-1h2" opacity="0.8" />
          <path d="M3 19c2 0 2 1 4 1s2-1 4-1 2 1 4 1 2-1 4-1h2" opacity="0.5" />
          <path d="M12 9V4m0 0-2 2m2-2 2 2" opacity="0.7" />
        </svg>
      )
    case 'et':
      return (
        <svg {...common}>
          <path d="M8 20c-1.5-2 1.5-3 0-5s1.5-3 0-5" />
          <path d="M12 20c-1.5-2 1.5-3 0-5s1.5-3 0-5s1.5-3 0-5" />
          <path d="M16 20c-1.5-2 1.5-3 0-5s1.5-3 0-5" />
        </svg>
      )
    case 'ndvi':
      return (
        <svg {...common}>
          <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" />
          <path d="M5 19 13 11" opacity="0.7" />
        </svg>
      )
  }
}
