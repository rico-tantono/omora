import { useState, type ReactNode } from 'react'
import { UserPlus, Users } from 'lucide-react'
import type { Group, Person } from '../types'
import { personAvatar } from '../lib/avatar'
import type { FriendActions } from '../hooks/useFriends'
import type { GroupActions } from '../hooks/useGroups'
import Avatar from '../components/Avatar'
import { LanternIcon } from '../components/Motifs'
import PageHeader from '../components/PageHeader'

interface Props {
  friendRequests: Person[]
  groupInvites: Group[]
  friendActions: FriendActions
  groupActions: GroupActions
}

// Updates lists what is waiting for an answer: connection requests and group invitations.
export default function UpdatesPage({ friendRequests, groupInvites, friendActions, groupActions }: Props) {
  const waiting = friendRequests.length + groupInvites.length

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <PageHeader title="Updates" subtitle={waiting > 0 ? `${waiting} waiting for you` : 'You are all caught up'} />

      {waiting === 0 ? (
        <div className="px-8 pt-16 text-center">
          <div className="relative mx-auto grid h-24 w-24 place-items-center" aria-hidden="true">
            <span className="lantern-glow absolute inset-0 rounded-full" />
            <LanternIcon className="relative h-14 w-10 text-ember-700" />
          </div>
          <h2 className="font-display mt-6 text-xl font-medium text-ember-900">Nothing new yet</h2>
          <p className="mt-2 text-sm text-ink-soft">Connection requests and group invitations will show up here.</p>
        </div>
      ) : (
        <ul className="space-y-2.5 px-5 pb-8">
          {friendRequests.map((person) => (
            <UpdateRow
              key={`friend-${person.id}`}
              icon={<UserPlus size={20} />}
              avatar={<Avatar name={person.displayName} src={personAvatar(person.username, person.avatarUrl ?? undefined)} size={44} />}
              text={`${person.displayName} wants to connect with you.`}
              detail={`@${person.username}`}
              acceptLabel="Accept"
              declineLabel="Decline"
              onRespond={(accept) => friendActions.respond(person.id, accept)}
            />
          ))}
          {groupInvites.map((group) => (
            <UpdateRow
              key={`group-${group.id}`}
              icon={<Users size={20} />}
              avatar={<Avatar name={group.name} src={group.avatar} shape="squircle" size={44} />}
              text={`${group.invitedBy ?? 'Someone'} invited you to join ${group.name}.`}
              detail={`${group.members.filter((m) => m.status === 'member').length} members`}
              acceptLabel="Join"
              declineLabel="Not now"
              onRespond={(accept) => groupActions.respond(group.id, accept)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

interface RowProps {
  icon: ReactNode
  avatar: ReactNode
  text: string
  detail: string
  acceptLabel: string
  declineLabel: string
  /** Resolves to an error message, or null when the answer was saved */
  onRespond: (accept: boolean) => Promise<string | null>
}

function UpdateRow({ icon, avatar, text, detail, acceptLabel, declineLabel, onRespond }: RowProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function respond(accept: boolean) {
    setBusy(true)
    setError('')
    const message = await onRespond(accept)
    if (message) {
      setError(message)
      setBusy(false)
    }
  }

  return (
    <li className="animate-rise rounded-xl bg-ember-200/40 p-4 ring-1 ring-ember-500/40">
      <div className="flex items-start gap-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="text-[0.95rem] leading-snug font-bold">{text}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
            {icon}
            {detail}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-ember-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => respond(true)} disabled={busy} className="h-11 flex-1 rounded-lg bg-ember-500 text-sm font-semibold text-on-accent disabled:opacity-70">
          {acceptLabel}
        </button>
        <button type="button" onClick={() => respond(false)} disabled={busy} className="h-11 flex-1 rounded-lg bg-card text-sm font-semibold text-ember-900 ring-1 ring-ink/10 disabled:opacity-70">
          {declineLabel}
        </button>
      </div>
    </li>
  )
}
