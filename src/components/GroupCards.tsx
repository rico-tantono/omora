import { useState, type CSSProperties } from 'react'
import { ArrowUpRight, ChevronDown, ChevronUp, Users } from 'lucide-react'
import type { Group } from '../types'
import { useAvatarTone } from '../hooks/useAvatarTone'
import Avatar, { AvatarStack } from './Avatar'

export interface StackMember {
  id: string
  name: string
  avatar?: string
}

interface CardProps {
  group: Group
  members: StackMember[]
  memoryCount: number
  onOpen: () => void
  delay?: number
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const memoriesLabel = (n: number) => (n === 1 ? '1 memory' : `${n} memories`)

interface ExpandedProps extends CardProps {
  /** Shows the "Most active" marker */
  mostActive?: boolean
  onCollapse: () => void
  onManage: () => void
}

// Expanded group: a deep gradient taken from the group's own picture, white text.
export function ExpandedGroupCard({ group, members, memoryCount, onOpen, onCollapse, onManage, mostActive, delay = 0 }: ExpandedProps) {
  const tone = useAvatarTone(group.avatar, group.name)
  const vars = { '--g-a': tone.a, '--g-b': tone.b, '--g-c': tone.c, '--g-hi': tone.hi, '--g-lo': tone.lo, animationDelay: `${delay}ms` } as CSSProperties

  return (
    <article className="surface-deep animate-rise rounded-2xl p-5" style={vars}>
      <div className="flex items-start justify-between gap-3">
        <Avatar name={group.name} src={group.avatar} shape="squircle" size={68} className="ring-2 ring-white/60" />
        <div className="flex items-center gap-2">
          {mostActive && (
            <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
              Most active
            </span>
          )}
        </div>
      </div>

      <h3 className="font-display mt-4 text-[1.6rem] leading-tight font-medium">{group.name}</h3>
      {group.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-white/85">{group.description}</p>}
      <button
        type="button"
        onClick={onCollapse}
        aria-label={`Collapse ${group.name}`}
        className="-ml-1 mt-1 inline-flex h-9 items-center gap-1 rounded-lg px-1 text-xs font-semibold text-white/80"
      >
        <ChevronUp size={14} /> Show less
      </button>

      <div className="mt-3 flex items-center gap-3 text-sm text-white/90">
        <AvatarStack members={members} size={26} ringClass="ring-white/0" ringColor={tone.b} />
        <span>{plural(members.length, 'member')}</span>
        {memoryCount > 0 && (
          <>
            <span className="text-white/50" aria-hidden="true">/</span>
            <span>{memoriesLabel(memoryCount)}</span>
          </>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/15 font-semibold backdrop-blur-sm"
        >
          Open shared map <ArrowUpRight size={18} />
        </button>
        <button
          type="button"
          onClick={onManage}
          aria-label={`Members and settings for ${group.name}`}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/30 bg-white/15 backdrop-blur-sm"
        >
          <Users size={20} />
        </button>
      </div>
    </article>
  )
}

// Compact row. Tap the name area to expand; the arrow opens the shared map.
export function GroupRow({ group, members, memoryCount, onOpen, onExpand, delay = 0 }: CardProps & { onExpand: () => void }) {
  return (
    <article
      className="animate-rise flex items-center gap-1 rounded-xl bg-card p-2 ring-1 ring-ink/10"
      style={{ animationDelay: `${delay}ms` }}
    >
      <button
        type="button"
        onClick={onExpand}
        aria-label={`Expand ${group.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left"
      >
        <Avatar name={group.name} src={group.avatar} shape="squircle" size={56} />
        <span className="min-w-0 flex-1">
          <span className="font-display block truncate text-[1.05rem] leading-snug font-medium text-ink">{group.name}</span>
          <span className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="truncate">{group.description}</span>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-ember-700">
              Expand <ChevronDown size={14} aria-hidden="true" />
            </span>
          </span>
          <span className="mt-1 flex items-center gap-2.5 text-xs text-ink-soft">
            <AvatarStack members={members} size={18} max={3} />
            <span>{plural(members.length, 'member')}</span>
            {memoryCount > 0 && <span>{memoriesLabel(memoryCount)}</span>}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${group.name} shared map`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sand text-ember-900"
      >
        <ArrowUpRight size={20} />
      </button>
    </article>
  )
}

interface InviteProps {
  group: Group
  invitedBy?: string
  members: StackMember[]
  /** Resolves to an error message, or null when the answer was saved */
  onRespond: (accept: boolean) => Promise<string | null>
  delay?: number
}

export function InviteCard({ group, invitedBy, members, onRespond, delay = 0 }: InviteProps) {
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
    <article
      className="animate-rise rounded-xl border border-ember-500/30 p-4"
      style={{ animationDelay: `${delay}ms`, background: 'rgba(255, 154, 128, 0.16)' }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={group.name} src={group.avatar} shape="squircle" size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-soft">{invitedBy ? `${invitedBy} invited you` : 'You are invited'}</p>
          <h3 className="font-display truncate text-lg leading-snug font-medium text-ink">{group.name}</h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
            <AvatarStack members={members} size={18} />
            <span>{plural(members.length, 'member')}</span>
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-ember-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={busy}
          className="h-11 flex-1 rounded-lg bg-ember-500 text-sm font-semibold text-on-accent disabled:opacity-70"
        >
          Join group
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={busy}
          className="h-11 flex-1 rounded-lg bg-card text-sm font-semibold text-ember-900 ring-1 ring-ink/10 disabled:opacity-70"
        >
          Not now
        </button>
      </div>
    </article>
  )
}
