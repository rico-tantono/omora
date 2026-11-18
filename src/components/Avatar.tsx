import { useState, type CSSProperties } from 'react'
import { initialsOf } from '../lib/text'

interface Props {
  name: string
  src?: string
  size?: number
  /** People are circles; groups are rounded squares */
  shape?: 'circle' | 'squircle'
  className?: string
}

// Shows the picture when there is one; otherwise (or if it fails to load)
// a consistent initials fallback.
export default function Avatar({ name, src, size = 48, shape = 'circle', className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed
  const isGroup = shape === 'squircle'

  return (
    <span
      className={`font-display relative inline-grid shrink-0 place-items-center overflow-hidden font-medium ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: isGroup ? Math.round(size * 0.3) : 9999,
        fontSize: size * 0.38,
        color: isGroup ? '#fff' : 'var(--color-ember-900)',
        background: isGroup
          ? 'linear-gradient(150deg, #FF7F61, #A02828)'
          : 'var(--color-ember-200)',
      }}
      aria-hidden="true"
    >
      {initialsOf(name, isGroup ? 2 : 1)}
      {showImage && (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  )
}

interface StackProps {
  members: { id: string; name: string; avatar?: string }[]
  size?: number
  max?: number
  /** Ring color that separates overlapping avatars */
  ringClass?: string
  /** Explicit ring color (overrides ringClass), e.g. a group's card color */
  ringColor?: string
}

export function AvatarStack({ members, size = 24, max = 3, ringClass = 'ring-card', ringColor }: StackProps) {
  const shown = members.slice(0, max)
  const extra = members.length - shown.length
  return (
    <span className="flex items-center" aria-hidden="true">
      {shown.map((m, i) => (
        <span key={m.id} className={`rounded-full ring-2 ${ringClass} ${i > 0 ? '-ml-2' : ''}`} style={ringColor ? ({ '--tw-ring-color': ringColor } as CSSProperties) : undefined}>
          <Avatar name={m.name} src={m.avatar} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className={`-ml-2 grid place-items-center rounded-full bg-ink/70 text-[10px] font-semibold text-white ring-2 ${ringClass}`}
          style={{ width: size, height: size, ...(ringColor ? ({ '--tw-ring-color': ringColor } as CSSProperties) : {}) }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}
