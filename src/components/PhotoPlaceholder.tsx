import { useState } from 'react'

interface Props {
  from: string
  to: string
  /** A real photo; the gradient shows until it loads, or if it can't */
  src?: string
  caption?: string
  className?: string
}

// Three layouts for the soft color fields, picked from the colors so each
// placeholder looks different but stays the same every time.
const layouts = [
  { a: '18% 14%', b: '90% 92%', c: '70% 38%' },
  { a: '84% 10%', b: '10% 90%', c: '28% 52%' },
  { a: '50% 0%', b: '15% 100%', c: '88% 62%' },
]

function layoutFor(from: string, to: string) {
  let h = 0
  for (const ch of from + to) h = (h * 31 + ch.charCodeAt(0)) | 0
  return layouts[Math.abs(h) % layouts.length]
}

// Layered, organic color fields with one soft curve; a real photo fades in over it.
export default function PhotoPlaceholder({ from, to, src, caption, className = '' }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const l = layoutFor(from, to)
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: [
          `radial-gradient(70% 85% at ${l.a}, ${from} 0%, transparent 72%)`,
          `radial-gradient(85% 80% at ${l.b}, ${to} 0%, transparent 74%)`,
          `radial-gradient(45% 55% at ${l.c}, rgba(255, 211, 196, 0.55) 0%, transparent 70%)`,
          `linear-gradient(150deg, ${from}, ${to})`,
        ].join(', '),
      }}
    >
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path d="M0 40 C22 24 42 52 64 36 S92 24 100 32 V60 H0Z" fill="#7D2020" fillOpacity=".22" />
      </svg>
      {src && !failed && (
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[550ms] ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {caption && (
        <span className="absolute bottom-2 left-2 rounded-full bg-black/35 px-2.5 py-0.5 text-[11px] text-white">
          {caption}
        </span>
      )}
    </div>
  )
}
