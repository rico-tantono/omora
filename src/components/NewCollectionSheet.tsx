import { useState } from 'react'
import { X } from 'lucide-react'
import type { Memory } from '../types'
import MemoryPicker from './MemoryPicker'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  memories: Memory[]
  /** Resolves to an error message, or null when the collection was created */
  onCreate: (name: string, memoryIds: string[]) => Promise<string | null>
  onClose: () => void
}

export default function NewCollectionSheet({ memories, onCreate, onClose }: Props) {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEscapeKey(saving ? undefined : onClose)

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function handleCreate() {
    if (!name.trim()) return setError('Give the collection a name.')
    setSaving(true)
    setError('')
    const message = await onCreate(name.trim(), picked)
    if (message) {
      setError(message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-end bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="New collection">
      <div className="animate-sheet flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-paper">
        <div className="flex shrink-0 items-center justify-between border-b border-ink/10 px-5 py-3">
          <h2 className="font-display text-xl font-medium text-ember-900">New collection</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-ink-soft">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rainy days, Favorite cafes…"
              maxLength={30}
              className="w-full rounded-lg border border-ink/15 bg-card px-4 py-3 text-ink placeholder:text-ink-soft/60 focus:border-ember-700 focus:outline-none"
            />
          </label>

          <div>
            <p className="mb-1.5 text-sm font-semibold">
              Memories <span className="font-normal text-ink-soft">({picked.length} selected, optional)</span>
            </p>
            <MemoryPicker memories={memories} selected={picked} onToggle={toggle} emptyText="You don’t have any memories yet. You can add some to this collection later." />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-ember-700">
              {error}
            </p>
          )}
        </div>

        <div className="pb-safe shrink-0 border-t border-ink/10">
          <div className="px-5 py-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="h-12 w-full rounded-xl bg-ember-500 font-semibold text-on-accent disabled:opacity-80"
            >
              {saving ? 'Creating…' : 'Create collection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
