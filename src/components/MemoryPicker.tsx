import { Check } from 'lucide-react'
import type { Memory } from '../types'
import { formatDate } from '../lib/format'
import PhotoPlaceholder from './PhotoPlaceholder'

interface Props {
  memories: Memory[]
  selected: string[]
  onToggle: (id: string) => void
  emptyText: string
}

export default function MemoryPicker({ memories, selected, onToggle, emptyText }: Props) {
  if (memories.length === 0) {
    return <p className="rounded-xl bg-sand p-4 text-sm text-ink-soft">{emptyText}</p>
  }
  return (
    <ul className="space-y-1.5">
      {memories.map((m) => {
        const on = selected.includes(m.id)
        const cover = m.photos[0]
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onToggle(m.id)}
              aria-pressed={on}
              className={`flex min-h-[64px] w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ring-1 transition-colors duration-[350ms] ${
                on ? 'bg-sage/20 ring-sage-deep/60' : 'bg-card ring-ink/10'
              }`}
            >
              <PhotoPlaceholder from={cover?.from ?? '#F0E7D5'} to={cover?.to ?? '#FFD3C4'} src={cover?.url} className="h-12 w-12 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.title}</span>
                <span className="block truncate text-sm text-ink-soft">
                  {m.placeName}, {formatDate(m.visitDate)}
                </span>
              </span>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${on ? 'bg-sage-deep text-white' : 'ring-1 ring-ink/20'}`}>
                {on && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
