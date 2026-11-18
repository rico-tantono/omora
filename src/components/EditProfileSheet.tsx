import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { AvatarChange, ProfileChanges } from '../types'
import { ACCEPTED_IMAGE_TYPES } from '../lib/imageProcessing'
import { validateUsername } from '../lib/validation'
import { defaultAvatarUri } from '../lib/avatar'
import Avatar from './Avatar'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  initial: ProfileChanges
  currentAvatarUrl: string | null
  /** Resolves to an error message, or null when saved */
  onSave: (changes: ProfileChanges, avatar?: AvatarChange) => Promise<string | null>
  onClose: () => void
}

const fieldClass =
  'w-full rounded-lg border border-ink/15 bg-card px-4 py-3 text-ink placeholder:text-ink-soft/60 focus:border-ember-700 focus:outline-none'

export default function EditProfileSheet({ initial, currentAvatarUrl, onSave, onClose }: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [username, setUsername] = useState(initial.username)
  const [bio, setBio] = useState(initial.bio)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEscapeKey(saving ? undefined : onClose)
  const [avatarChange, setAvatarChange] = useState<AvatarChange | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  function chooseFile(file: File | undefined) {
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setAvatarChange({ kind: 'upload', file })
    setError('')
    if (fileInput.current) fileInput.current.value = ''
  }

  function removePhoto() {
    setPreview(null)
    setAvatarChange({ kind: 'remove' })
  }

  const hasCustomPhoto = avatarChange?.kind === 'upload' || (avatarChange?.kind !== 'remove' && Boolean(currentAvatarUrl))
  const shownSrc =
    avatarChange?.kind === 'upload' && preview
      ? preview
      : avatarChange?.kind === 'remove' || !currentAvatarUrl
        ? defaultAvatarUri(username)
        : currentAvatarUrl

  async function handleSave() {
    const nameError = !displayName.trim() ? 'Add a display name.' : null
    const userError = validateUsername(username)
    if (nameError || userError) return setError(nameError ?? userError ?? '')

    setSaving(true)
    setError('')
    const result = await onSave(
      { displayName: displayName.trim(), username: username.trim(), bio: bio.trim() },
      avatarChange ?? undefined,
    )
    setSaving(false)
    if (result) setError(result)
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-end bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Edit profile details">
      <div className="animate-sheet flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-paper">
        <div className="flex shrink-0 items-center justify-between border-b border-ink/10 px-5 py-3">
          <h2 className="font-display text-xl font-medium text-ember-900">Edit profile</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-ink-soft">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="flex items-center gap-4">
            <Avatar name={displayName || username} src={shownSrc} size={64} />
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={saving}
                  className="h-10 rounded-lg px-4 text-sm font-semibold text-ember-900 ring-1 ring-ink/15"
                >
                  Change photo
                </button>
                {hasCustomPhoto && (
                  <button type="button" onClick={removePhoto} disabled={saving} className="h-10 rounded-lg px-3 text-sm font-semibold text-ember-700">
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                {hasCustomPhoto ? 'Saved when you press Save changes.' : 'Without a photo, your picture takes its color from your username.'}
              </p>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => chooseFile(e.target.files?.[0])}
              />
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Display name</span>
            <input className={fieldClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} autoComplete="name" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Username</span>
            <input className={fieldClass} value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Bio</span>
            <textarea className={`${fieldClass} min-h-24 resize-none`} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={140} placeholder="A line about you and your places" />
            <span className="mt-1 block text-right text-xs text-ink-soft">{bio.length}/140</span>
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-ember-700">
              {error}
            </p>
          )}
        </div>

        <div className="pb-safe shrink-0 border-t border-ink/10">
          <div className="px-5 py-3">
            <button type="button" onClick={handleSave} disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ember-500 font-semibold text-on-accent disabled:opacity-80">
              {saving && <Loader2 size={18} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
