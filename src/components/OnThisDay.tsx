import type { Memory } from '../types'
import { formatDate } from '../lib/format'
import { yearsAgo } from '../lib/onThisDay'
import { LanternIcon } from './Motifs'
import PhotoPlaceholder from './PhotoPlaceholder'

interface Props {
  memories: Memory[] // already filtered to today's matches
  onOpen: (id: string) => void
}

export default function OnThisDay({ memories, onOpen }: Props) {
  if (memories.length === 0) return null
  return (
    <section className="mt-8 px-5" aria-label="On this day">
      <div className="flex items-center gap-2.5">
        <span className="relative grid h-10 w-10 place-items-center" aria-hidden="true">
          <span className="lantern-glow absolute inset-0 rounded-full" />
          <LanternIcon className="relative h-7 w-5 text-ember-700" />
        </span>
        <h2 className="font-display text-xl font-medium text-ember-900">On this day</h2>
      </div>
      <ul className="mt-3 space-y-3">
        {memories.map((m) => {
          const years = yearsAgo(m.visitDate)
          const cover = m.photos[0]
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onOpen(m.id)}
                className="animate-rise relative block w-full overflow-hidden rounded-lg bg-card text-left ring-1 ring-ink/10"
              >
                <PhotoPlaceholder
                  from={cover?.from ?? '#FFD6C7'}
                  to={cover?.to ?? '#FF6B4A'}
                  src={cover?.url}
                  className="fade-right absolute inset-y-0 left-0 w-[46%]"
                />
                <span className="relative block py-4 pr-4 pl-[40%]">
                  <span className="block text-xs font-medium text-ember-700">
                    {years === 1 ? '1 year ago today' : `${years} years ago today`}
                  </span>
                  <span className="font-display mt-1 line-clamp-2 block leading-snug font-medium text-ink">{m.title}</span>
                  <span className="mt-1 block truncate text-sm text-ink-soft">{m.placeName}</span>
                  <span className="block text-xs text-ink-soft">{formatDate(m.visitDate)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
