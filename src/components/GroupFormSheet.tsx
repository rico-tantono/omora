import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { Group, GroupAvatarChoice } from '../types'
import { ACCEPTED_IMAGE_TYPES } from '../lib/imageProcessing'
import { GROUP_AVATAR_PRESETS, presetSrc } from '../lib/groupAvatars'
import type { InviteFailure } from '../services/groups'
import Avatar from './Avatar'
import { useEscapeKey } from '../hooks/useEscapeKey'

export interface GroupFormValues {
  name: string
  description: string
  avatar: GroupAvatarChoice
  usernames: string[]
}

interface Props {
  /** Present when editing an existing group */
  group?: Group
  /** Resolves to an error message (or null) and, when creating, any invitations that failed */
  onSubmit: (values: GroupFormValues) => Promise<{ error: string | null; inviteFailures?: InviteFailure[] }>
  onClose: () => void
}

const fieldClass =
  'w-full rounded-lg border border-ink/15 bg-card px-4 py-3 text-ink placeholder:text-ink-soft/60 focus:border-ember-700 focus:outline-none'

const MAX_INVITES = 20

function parseUsernames(text: string): string[] {
  const names = text
    .split(/[\s,]+/)
    .map((name) => name.replace(/^@/, '').trim())
    .filter(Boolean)
  return [...new Set(names)].slice(0, MAX_INVITES)
}

// One form for both creating and editing. A group is the people and their ongoing relationship,
// so there are no dates or destinations here; those belong to memories.
export default function GroupFormSheet({ group, onSubmit, onClose }: Props) {
  const editing = Boolean(group)
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [choice, setChoice] = useState<GroupAvatarChoice>(editing ? { kind: 'keep' } : { kind: 'preset', key: 'ember' })
  const [preview, setPreview] = useState<string | null>(null)
  const [inviteText, setInviteText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEscapeKey(saving ? undefined : onClose)
  const [failures, setFailures] = useState<InviteFailure[] | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  function chooseFile(file: File | undefined) {
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setChoice({ kind: 'upload', file })
    if (fileInput.current) fileInput.current.value = ''
  }

  const shownSrc =
    choice.kind === 'upload'
      ? (preview ?? undefined)
      : choice.kind === 'preset'
        ? presetSrc(choice.key)
        : choice.kind === 'keep'
          ? group?.avatar
          : undefined

  async function handleSubmit() {
    if (!name.trim()) return setError('Give your group a name.')
    setSaving(true)
    setError('')
    const result = await onSubmit({
      name: name.trim(),
      description: description.trim(),
      avatar: choice,
      usernames: editing ? [] : parseUsernames(inviteText),
    })
    setSaving(false)
    if (result.error) return setError(result.error)
    if (result.inviteFailures && result.inviteFailures.length > 0) return setFailures(result.inviteFailures)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-end bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={editing ? 'Edit group' : 'Create a group'}>
      <div className="animate-sheet flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-paper">
        <div className="flex shrink-0 items-center justify-between border-b border-ink/10 px-5 py-3">
          <h2 className="font-display text-xl font-medium text-ember-900">{editing ? 'Edit group' : 'New group'}</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-ink-soft">
            <X size={20} />
          </button>
        </div>

        {failures ? (
          <div className="px-5 py-6">
            <h3 className="font-display text-lg font-medium text-ember-900">Your group is ready</h3>
            <p className="mt-2 text-sm text-ink-soft">Some invitations couldn’t be sent. You can try again from the group’s members screen.</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {failures.map((f) => (
                <li key={f.username}>
                  <span className="font-semibold">@{f.username}</span>: {f.message}
                </li>
              ))}
            </ul>
            <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-xl bg-ember-500 font-semibold text-on-accent">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
              <div className="flex items-center gap-4">
                <Avatar name={name || 'Group'} src={shownSrc} shape="squircle" size={76} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Group picture</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {GROUP_AVATAR_PRESETS.map((preset) => {
                      const on = choice.kind === 'preset' && choice.key === preset.key
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => setChoice({ kind: 'preset', key: preset.key })}
                          aria-label={`${preset.label} picture`}
                          aria-pressed={on}
                          className={`rounded-lg p-0.5 ${on ? 'ring-2 ring-ember-700' : 'ring-1 ring-ink/10'}`}
                        >
                          <Avatar name={preset.label} src={preset.src} shape="squircle" size={36} />
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      aria-pressed={choice.kind === 'upload'}
                      className={`h-[44px] rounded-lg px-3 text-xs font-semibold text-ember-900 ${choice.kind === 'upload' ? 'ring-2 ring-ember-700' : 'ring-1 ring-ink/10'}`}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setChoice({ kind: 'none' })}
                      aria-pressed={choice.kind === 'none'}
                      className={`h-[44px] rounded-lg px-3 text-xs font-semibold text-ember-900 ${choice.kind === 'none' ? 'ring-2 ring-ember-700' : 'ring-1 ring-ink/10'}`}
                    >
                      Initials
                    </button>
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
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Group name</span>
                <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="The Usuals" maxLength={32} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Description (optional)</span>
                <textarea className={`${fieldClass} min-h-20 resize-none`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who are you to each other?" maxLength={90} />
              </label>

              {!editing && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Invite people (optional)</span>
                  <input
                    className={fieldClass}
                    value={inviteText}
                    onChange={(e) => setInviteText(e.target.value)}
                    placeholder="Usernames, separated by commas"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <span className="mt-1 block text-xs text-ink-soft">They join once they accept. You can invite more later.</span>
                </label>
              )}

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
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ember-500 font-semibold text-on-accent disabled:opacity-80"
                >
                  {saving && <Loader2 size={18} className="animate-spin" />}
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create group'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
