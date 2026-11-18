import { X } from 'lucide-react'
import type { GeoResult } from '../services/geocoding'

interface Props {
  place: GeoResult
  onAddMemory: () => void
  onClose: () => void
}

export default function SearchResultCard({ place, onAddMemory, onClose }: Props) {
  return (
    <section
      aria-label="Selected location"
      className="animate-sheet pb-safe absolute inset-x-0 bottom-0 z-[1100] glass-sheet rounded-t-2xl"
    >
      <div className="px-5 pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-soft">{place.category}</p>
            <h2 className="font-display text-xl leading-snug font-medium text-ink">{place.name}</h2>
            {place.address && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{place.address}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss location"
            className="-mt-1 -mr-2 grid h-11 w-11 shrink-0 place-items-center text-ink-soft"
          >
            <X size={20} />
          </button>
        </div>
        <button type="button" onClick={onAddMemory} className="btn-lacquer mt-4 h-12 w-full rounded-xl font-semibold">
          Add a memory here
        </button>
      </div>
    </section>
  )
}
