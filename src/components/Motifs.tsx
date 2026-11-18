import type { SVGProps } from 'react'

// A few small Japanese motifs, used sparingly: a torii gate (arrival, new maps),
// a chochin lantern (a memory resurfacing), a sakura flower (keepsakes).
// All draw in currentColor so each placement can pick its palette color.
type IconProps = SVGProps<SVGSVGElement>

export function ToriiIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2 8 Q32 16 62 8 L60 14.5 Q32 22.5 4 14.5 Z" />
      <rect x="10" y="26" width="44" height="4.5" rx="1" />
      <rect x="30" y="17" width="4" height="9.5" />
      <rect x="12" y="16" width="5.5" height="46" rx="1" />
      <rect x="46.5" y="16" width="5.5" height="46" rx="1" />
    </svg>
  )
}

export function LanternIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 40 56" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20 0 V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="11" y="5" width="18" height="5" rx="1.5" />
      <path d="M9 11 C1 19 1 37 9 45 H31 C39 37 39 19 31 11 Z" />
      <path
        d="M5.5 21 H34.5 M4 28 H36 M5.5 35 H34.5"
        stroke="var(--color-paper)"
        strokeOpacity=".4"
        strokeWidth="1.2"
        fill="none"
      />
      <rect x="11" y="45" width="18" height="5" rx="1.5" />
      <path d="M20 50 V55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// Five notched petals with a second inner contour and a ringed center,
// after the reference drawing. Outline when filled={false}, solid otherwise.
const PETAL_OUTER = 'M50 44 C42 38 30 26 33 12 C35 6 43 4 47.5 8 L50 10.5 L52.5 8 C57 4 65 6 67 12 C70 26 58 38 50 44 Z'
const PETAL_INNER = 'M50 40 C43 35 35 25 38 15 C39.5 11 44 10 47.5 12.5 L50 14.5 L52.5 12.5 C56 10 60.5 11 62 15 C65 25 57 35 50 40 Z'

export function SakuraIcon({ filled = true, strokeWidth = 3, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" strokeLinejoin="round" strokeLinecap="round" {...props}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 50 50)`}>
          <path d={PETAL_OUTER} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={strokeWidth} />
          <path
            d={PETAL_INNER}
            fill="none"
            stroke={filled ? 'var(--color-paper)' : 'currentColor'}
            strokeWidth={Math.max(strokeWidth * 0.55, 1.2)}
            strokeOpacity={filled ? 0.7 : 0.9}
          />
        </g>
      ))}
      <circle cx="50" cy="50" r="8.5" fill={filled ? 'var(--color-paper)' : 'none'} stroke="currentColor" strokeWidth={strokeWidth * 0.8} />
      <circle cx="50" cy="50" r="3.6" fill="currentColor" stroke="none" />
    </svg>
  )
}
