import { X } from 'lucide-react'
import type { Person } from '../types'
import { personAvatar } from '../lib/avatar'
import Avatar from './Avatar'
import ConfirmButton from './ConfirmButton'
import { useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  person: Person
  /** Resolves to an error message, or null when the connection was removed */
  onRemove: () => Promise<string | null>
  onClose: () => void
}

export default function FriendSheet({ person, onRemove, onClose }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEscapeKey(busy ? undefined : onClose)

  async function remove() {
    setBusy(true)
    setError('')
    const message = await onRemove()
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-end bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={person.displayName}>
      <div className="animate-sheet w-full rounded-t-2xl bg-paper">
        <div className="flex justify-end px-3 pt-3">
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-ink-soft">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 pb-6">
          <div className="flex items-center gap-4">
            <Avatar name={person.displayName} src={personAvatar(person.username, person.avatarUrl ?? undefined)} size={72} />
            <div className="min-w-0">
              <h2 className="font-display truncate text-2xl leading-tight font-medium text-ember-900">{person.displayName}</h2>
              <p className="truncate text-sm text-ink-soft">@{person.username}</p>
            </div>
          </div>
          {person.bio && <p className="mt-4 text-[0.95rem] leading-relaxed text-ink">{person.bio}</p>}
          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-ember-700">
              {error}
            </p>
          )}
          <div className="mt-6">
            <ConfirmButton
              label="Remove connection"
              confirmLabel="Tap again to remove"
              active={confirming}
              busy={busy}
              onArm={() => setConfirming(true)}
              onCancel={() => setConfirming(false)}
              onConfirm={remove}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
