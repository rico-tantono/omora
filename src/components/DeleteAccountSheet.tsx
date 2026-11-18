import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  username: string
  /** Resolves to an error message; on success the app signs you out and this sheet goes away */
  onDelete: () => Promise<string | null>
  onClose: () => void
}

// Typing the username makes deleting an account a deliberate act.
export default function DeleteAccountSheet({ username, onDelete, onClose }: Props) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEscapeKey(busy ? undefined : onClose)

  const confirmed = typed.trim().toLowerCase() === username.toLowerCase()

  async function remove() {
    setBusy(true)
    setError('')
    const message = await onDelete()
    if (message) {
      setError(message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1500] flex items-end bg-ink/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Delete account">
      <div className="animate-sheet pb-safe max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-paper">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-display text-xl font-medium text-ember-900">Delete your account</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-sand">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-relaxed text-ink">This permanently deletes:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>your profile and picture</li>
            <li>your memories and their photos, including the ones you shared</li>
            <li>your collections and your connections</li>
            <li>the groups you own. Other members’ memories in them go back to being private.</li>
          </ul>
          <p className="text-sm font-semibold text-ember-700">This can’t be undone.</p>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              Type <span className="font-mono">{username}</span> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-ink/15 bg-card px-4 py-3 text-ink focus:border-ember-700 focus:outline-none"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-ember-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={remove}
            disabled={!confirmed || busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ember-700 font-semibold text-white disabled:opacity-40"
          >
            {busy && <Loader2 size={18} className="animate-spin" />}
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  )
}
