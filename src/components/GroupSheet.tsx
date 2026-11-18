import { useState } from 'react'
import { X } from 'lucide-react'
import type { Group, Person } from '../types'
import { personAvatar } from '../lib/avatar'
import type { GroupActions } from '../hooks/useGroups'
import Avatar from './Avatar'
import ConfirmButton from './ConfirmButton'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  group: Group
  currentUserId: string
  /** Your connections, for inviting with one tap */
  friends: Person[]
  actions: GroupActions
  onEdit: () => void
  onClose: () => void
}

type Confirming = 'leave' | 'delete' | null

// Members and settings for one group. Owners invite, remove, edit and delete; members can leave.
export default function GroupSheet({ group, currentUserId, friends, actions, onEdit, onClose }: Props) {
  const isOwner = group.ownerId === currentUserId
  useEscapeKey(onClose)
  const invitable = friends.filter((f) => f.status === 'connected' && !group.members.some((m) => m.userId === f.id))
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState<Confirming>(null)

  // Runs an action, showing its error in place. The sheet closes by itself when the group goes away.
  async function run(action: () => Promise<string | null>, onDone?: () => void) {
    setBusy(true)
    setError('')
    setNote('')
    const message = await action()
    setBusy(false)
    if (message) setError(message)
    else onDone?.()
  }

  const invite = () => {
    const name = username.replace(/^@/, '').trim()
    if (!name) return
    void run(
      () => actions.invite(group.id, name),
      () => {
        setUsername('')
        setNote(`Invitation sent to @${name}.`)
      },
    )
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-end bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${group.name} members`}>
      <div className="animate-sheet flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-paper">
        <div className="flex shrink-0 items-center gap-3 border-b border-ink/10 px-5 py-3">
          <Avatar name={group.name} src={group.avatar} shape="squircle" size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display truncate text-xl leading-tight font-medium text-ember-900">{group.name}</h2>
            {group.description && <p className="truncate text-sm text-ink-soft">{group.description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          {isOwner && (
            <div>
              <label htmlFor="invite-username" className="mb-1.5 block text-sm font-semibold">
                Invite by username
              </label>
              <div className="flex gap-2">
                <input
                  id="invite-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && invite()}
                  placeholder="their.username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-12 min-w-0 flex-1 rounded-lg border border-ink/15 bg-card px-4 text-ink placeholder:text-ink-soft/60 focus:border-ember-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={invite}
                  disabled={busy || !username.trim()}
                  className="h-12 shrink-0 rounded-lg bg-ember-500 px-5 font-semibold text-on-accent disabled:opacity-50"
                >
                  Invite
                </button>
              </div>
              {note && <p className="mt-2 text-sm text-sage-deep">{note}</p>}

              {invitable.length > 0 && (
                <ul className="mt-3 divide-y divide-ink/10" aria-label="Invite a connection">
                  {invitable.map((friend) => (
                    <li key={friend.id} className="flex items-center gap-3 py-2">
                      <Avatar name={friend.displayName} src={personAvatar(friend.username, friend.avatarUrl ?? undefined)} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{friend.displayName}</p>
                        <p className="truncate text-sm text-ink-soft">@{friend.username}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            () => actions.invite(group.id, friend.username),
                            () => setNote(`Invitation sent to @${friend.username}.`),
                          )
                        }
                        disabled={busy}
                        className="h-10 shrink-0 rounded-lg px-4 text-sm font-semibold text-ember-900 ring-1 ring-ink/15 disabled:opacity-50"
                      >
                        Invite
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-ember-700">
              {error}
            </p>
          )}

          <section aria-label="Members">
            <h3 className="font-display mb-2 text-lg font-medium text-ember-900">
              Members <span className="text-sm font-normal text-ink-soft">({group.members.filter((m) => m.status === 'member').length})</span>
            </h3>
            <ul className="divide-y divide-ink/10">
              {group.members.map((member) => {
                const isMe = member.userId === currentUserId
                const pending = member.status === 'invited'
                return (
                  <li key={member.userId} className="flex items-center gap-3 py-2.5">
                    <Avatar name={member.displayName} src={personAvatar(member.username, member.avatarUrl ?? undefined)} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">
                        {member.displayName}
                        {isMe && <span className="font-normal text-ink-soft"> (you)</span>}
                      </p>
                      <p className="truncate text-sm text-ink-soft">@{member.username}</p>
                    </div>
                    {member.role === 'owner' && <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-ember-900">Owner</span>}
                    {pending && <span className="rounded-full bg-ember-200 px-2.5 py-1 text-xs font-semibold text-ember-900">Invited</span>}
                    {isOwner && !isMe && (
                      <button
                        type="button"
                        onClick={() => run(() => actions.removeMember(group.id, member.userId))}
                        disabled={busy}
                        aria-label={pending ? `Cancel invitation for ${member.displayName}` : `Remove ${member.displayName}`}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-soft"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <div className="space-y-2 pb-2">
            {isOwner ? (
              <>
                <button type="button" onClick={onEdit} className="h-12 w-full rounded-xl border border-ink/15 font-semibold text-ember-900">
                  Edit group
                </button>
                <ConfirmButton
                  label="Delete group"
                  confirmLabel="Tap again to delete for everyone"
                  active={confirming === 'delete'}
                  busy={busy}
                  onArm={() => setConfirming('delete')}
                  onCancel={() => setConfirming(null)}
                  onConfirm={() => run(() => actions.remove(group))}
                />
              </>
            ) : (
              <ConfirmButton
                label="Leave group"
                confirmLabel="Tap again to leave"
                active={confirming === 'leave'}
                busy={busy}
                onArm={() => setConfirming('leave')}
                onCancel={() => setConfirming(null)}
                onConfirm={() => run(() => actions.leave(group.id))}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
