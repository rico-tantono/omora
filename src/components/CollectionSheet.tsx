import { useState } from 'react'
import { ChevronLeft, Plus, X } from 'lucide-react'
import type { Collection, Memory } from '../types'
import { formatDate } from '../lib/format'
import PhotoPlaceholder from './PhotoPlaceholder'
import MemoryPicker from './MemoryPicker'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  collection: Collection
  /** The user's own memories */
  memories: Memory[]
  /** Resolve to an error message, or null when the action worked */
  onAdd: (memoryIds: string[]) => Promise<string | null>
  onRemove: (memoryId: string) => Promise<string | null>
  onOpenMemory: (id: string) => void
  onClose: () => void
}

export default function CollectionSheet({ collection, memories, onAdd, onRemove, onOpenMemory, onClose }: Props) {
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEscapeKey(busy ? undefined : onClose)

  const inCollection = collection.memoryIds
    .map((id) => memories.find((m) => m.id === id))
    .filter((m): m is Memory => Boolean(m))
  const available = memories.filter((m) => !collection.memoryIds.includes(m.id))

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function confirmAdd() {
    if (picked.length === 0) return
    setBusy(true)
    setError('')
    const message = await onAdd(picked)
    setBusy(false)
    if (message) return setError(message)
    setPicked([])
    setAdding(false)
  }

  async function handleRemove(memoryId: string) {
    setError('')
    const message = await onRemove(memoryId)
    if (message) setError(message)
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-end bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Collection: ${collection.name}`}>
      <div className="animate-sheet relative flex max-h-[92dvh] min-h-[60dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-paper">
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-3">
          {adding ? (
            <button type="button" onClick={() => setAdding(false)} aria-label="Back to collection" className="glass grid h-11 w-11 place-items-center rounded-full text-ink">
              <ChevronLeft size={22} />
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} aria-label="Close collection" className="glass grid h-11 w-11 place-items-center rounded-full text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
          <PhotoPlaceholder from={collection.from} to={collection.to} className="fade-bottom h-40 w-full" />

          <div className="relative -mt-12 px-5">
            <p className="text-xs text-ink-soft">Collection</p>
            <h2 className="font-display text-[1.75rem] leading-tight font-medium text-ember-900">{collection.name}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {inCollection.length === 1 ? '1 memory' : `${inCollection.length} memories`}
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm font-medium text-ember-700">
                {error}
              </p>
            )}

            {adding ? (
              <div className="mt-5">
                <h3 className="font-display mb-3 text-lg font-medium">Add to this collection</h3>
                <MemoryPicker
                  memories={available}
                  selected={picked}
                  onToggle={toggle}
                  emptyText="Every memory you own is already in this collection."
                />
                <button
                  type="button"
                  onClick={confirmAdd}
                  disabled={picked.length === 0 || busy}
                  className="mt-4 h-12 w-full rounded-xl bg-ember-500 font-semibold text-on-accent disabled:opacity-40"
                >
                  {busy ? 'Adding…' : picked.length === 0 ? 'Choose memories to add' : `Add ${picked.length} ${picked.length === 1 ? 'memory' : 'memories'}`}
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="btn-lacquer mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold"
                >
                  <Plus size={18} /> Add a memory
                </button>

                {inCollection.length === 0 ? (
                  <p className="mt-5 rounded-xl bg-sand p-4 text-sm text-ink-soft">Nothing here yet. Add a memory to start this collection.</p>
                ) : (
                  <ul className="mt-5 space-y-2">
                    {inCollection.map((m) => {
                      const cover = m.photos[0]
                      return (
                        <li key={m.id} className="flex items-center gap-1 rounded-xl bg-card p-2 ring-1 ring-ink/10">
                          <button type="button" onClick={() => onOpenMemory(m.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left">
                            <PhotoPlaceholder from={cover?.from ?? '#F0E7D5'} to={cover?.to ?? '#FFD3C4'} src={cover?.url} className="h-14 w-14 shrink-0 rounded-lg" />
                            <span className="min-w-0">
                              <span className="font-display line-clamp-2 leading-snug font-medium">{m.title}</span>
                              <span className="block truncate text-sm text-ink-soft">
                                {m.placeName}, {formatDate(m.visitDate)}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(m.id)}
                            aria-label={`Remove ${m.title} from collection`}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-soft"
                          >
                            <X size={18} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
