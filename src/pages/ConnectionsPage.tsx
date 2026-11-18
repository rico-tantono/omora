import { useEffect, useState, type ReactNode } from 'react'
import { Check, Plus, Search, Users } from 'lucide-react'
import type { ConnectionStatus, Group, Memory, Person } from '../types'
import { memoryCountForGroup } from '../lib/identity'
import { firstName } from '../lib/text'
import { personAvatar } from '../lib/avatar'
import { searchPeople } from '../services/friends'
import type { FriendActions } from '../hooks/useFriends'
import type { GroupActions } from '../hooks/useGroups'
import PageHeader from '../components/PageHeader'
import SegmentedControl from '../components/SegmentedControl'
import { SakuraIcon } from '../components/Motifs'
import Avatar from '../components/Avatar'
import GroupFormSheet from '../components/GroupFormSheet'
import FriendSheet from '../components/FriendSheet'
import GroupSheet from '../components/GroupSheet'
import { ExpandedGroupCard, GroupRow, InviteCard, type StackMember } from '../components/GroupCards'

type Tab = 'groups' | 'friends'

interface Props {
  currentUserId: string
  people: Person[]
  friendActions: FriendActions
  groups: Group[]
  groupActions: GroupActions
  memories: Memory[]
  onOpenGroupMap: (groupId: string) => void
}

export default function ConnectionsPage(props: Props) {
  const [tab, setTab] = useState<Tab>('groups')

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden overscroll-contain">
      <SakuraIcon
        filled={false}
        strokeWidth={2.4}
        className="pointer-events-none absolute -top-3 -right-8 h-36 w-36 sm:-top-5 sm:-right-14 sm:h-52 sm:w-52 -rotate-12 text-ember-700/10"
      />
      <div className="relative">
        <PageHeader title="Connections" subtitle="Your people, and the groups you share" />
        <div className="px-5">
          <SegmentedControl<Tab>
            label="Connections view"
            value={tab}
            onChange={setTab}
            options={[
              { id: 'groups', label: 'Groups' },
              { id: 'friends', label: 'Add friend' },
            ]}
          />
        </div>

        {/* Keyed so each tab eases in when you switch */}
        <div key={tab} className="animate-rise px-5 pt-5 pb-8">
          {tab === 'groups' ? <GroupsTab {...props} /> : <PeopleTab people={props.people} actions={props.friendActions} />}
        </div>
      </div>
    </div>
  )
}

function GroupsTab({ currentUserId, people, groups, groupActions, memories, onOpenGroupMap }: Props) {
  const [creating, setCreating] = useState(false)
  const [managingId, setManagingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Only one group is expanded at a time. undefined = default (the most active one); null = none.
  const [expandedId, setExpandedId] = useState<string | null | undefined>(undefined)

  const membersOf = (g: Group): StackMember[] =>
    g.members
      .filter((m) => m.status === 'member')
      .map((m) => ({ id: m.userId, name: m.displayName, avatar: personAvatar(m.username, m.avatarUrl ?? undefined) }))

  const joined = groups.filter((g) => g.myStatus === 'member')
  const invites = groups.filter((g) => g.myStatus === 'invited')

  // The group with the most memories is expanded by default
  const counts = new Map(joined.map((g) => [g.id, memoryCountForGroup(memories, g.id)]))
  const featured = joined.reduce<Group | null>(
    (best, g) => ((counts.get(g.id) ?? 0) > (best ? counts.get(best.id) ?? 0 : 0) ? g : best),
    null,
  )
  const currentExpanded = expandedId === undefined ? (featured?.id ?? null) : expandedId
  const isExpanded = (g: Group) => g.id === currentExpanded

  const managing = groups.find((g) => g.id === managingId)
  const editing = groups.find((g) => g.id === editingId)

  return (
    <>
      {invites.length > 0 && (
        <section className="mb-6 space-y-3" aria-label="Invitations">
          {invites.map((g, i) => (
            <InviteCard
              key={g.id}
              group={g}
              delay={i * 100}
              members={membersOf(g)}
              invitedBy={g.invitedBy}
              onRespond={(accept) => groupActions.respond(g.id, accept)}
            />
          ))}
        </section>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-medium text-ember-900">Your groups</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ember-700 ring-1 ring-ember-500/40"
        >
          <Plus size={16} /> New group
        </button>
      </div>

      {joined.length === 0 ? (
        <div className="rounded-xl bg-card p-6 text-center ring-1 ring-ink/10">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-sand text-ember-700">
            <Users size={22} />
          </div>
          <h3 className="font-display mt-4 text-lg font-medium text-ember-900">No groups yet</h3>
          <p className="mt-1 text-sm text-ink-soft">A group is the people you keep making memories with. One group, one shared map, as many memories as you like.</p>
          <button type="button" onClick={() => setCreating(true)} className="mt-4 h-11 rounded-lg bg-ember-500 px-5 text-sm font-semibold text-on-accent">
            Start a group
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {joined.map((g, i) =>
            isExpanded(g) ? (
              <ExpandedGroupCard
                key={g.id}
                group={g}
                delay={i * 90}
                members={membersOf(g)}
                memoryCount={counts.get(g.id) ?? 0}
                mostActive={g.id === featured?.id}
                onOpen={() => onOpenGroupMap(g.id)}
                onManage={() => setManagingId(g.id)}
                onCollapse={() => setExpandedId(null)}
              />
            ) : (
              <GroupRow
                key={g.id}
                group={g}
                delay={i * 90}
                members={membersOf(g)}
                memoryCount={counts.get(g.id) ?? 0}
                onOpen={() => onOpenGroupMap(g.id)}
                onExpand={() => setExpandedId(g.id)}
              />
            ),
          )}
        </div>
      )}

      {creating && (
        <GroupFormSheet
          onSubmit={(v) =>
            groupActions.create({ name: v.name, description: v.description, avatar: v.avatar }, v.usernames)
          }
          onClose={() => setCreating(false)}
        />
      )}

      {managing && (
        <GroupSheet
          group={managing}
          currentUserId={currentUserId}
          friends={people}
          actions={groupActions}
          onEdit={() => setEditingId(managing.id)}
          onClose={() => setManagingId(null)}
        />
      )}

      {editing && (
        <GroupFormSheet
          group={editing}
          onSubmit={async (v) => ({
            error: await groupActions.update(editing, { name: v.name, description: v.description, avatar: v.avatar }),
          })}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  )
}

type Phase = 'idle' | 'loading' | 'error' | 'done'

const MIN_QUERY_LENGTH = 3

function PeopleTab({ people, actions }: { people: Person[]; actions: FriendActions }) {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [results, setResults] = useState<Person[]>([])
  const [attempt, setAttempt] = useState(0)
  const [actionError, setActionError] = useState('')
  const [viewingId, setViewingId] = useState<string | null>(null)

  const trimmed = query.trim()

  // Debounced search; a response that arrives after the query changed is ignored.
  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setPhase('idle')
      return
    }
    setPhase('loading')
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchPeople(trimmed)
        if (cancelled) return
        setResults(found)
        setPhase('done')
      } catch {
        if (!cancelled) setPhase('error')
      }
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [trimmed, attempt])

  // Runs an action and, when it worked, shows the new relationship in the search results.
  async function act(
    personId: string,
    run: () => Promise<{ error: string | null; status?: ConnectionStatus }>,
    fallback: ConnectionStatus,
  ) {
    setActionError('')
    const { error, status } = await run()
    if (error) return setActionError(error)
    setResults((list) => list.map((p) => (p.id === personId ? { ...p, status: status ?? fallback } : p)))
  }

  const settled = (promise: Promise<string | null>) => promise.then((error) => ({ error }))

  const actionsFor = (p: Person) => {
    switch (p.status) {
      case 'incoming':
        return (
          <>
            <button type="button" onClick={() => act(p.id, () => settled(actions.respond(p.id, true)), 'connected')} className="h-10 rounded-lg bg-ember-500 px-4 text-sm font-semibold text-on-accent">Accept</button>
            <button type="button" onClick={() => act(p.id, () => settled(actions.respond(p.id, false)), 'none')} className="h-10 rounded-lg bg-sand px-3 text-sm font-semibold text-ember-900">Decline</button>
          </>
        )
      case 'requested':
        return (
          <button type="button" onClick={() => act(p.id, () => settled(actions.cancel(p.id)), 'none')} aria-label={`Cancel request to ${p.displayName}`} className="h-10 rounded-lg px-3 text-sm font-semibold text-ink-soft ring-1 ring-ink/15">
            Pending
          </button>
        )
      case 'connected':
        return (
          <span className="flex items-center gap-1 text-sm font-medium text-ink-soft">
            <Check size={16} /> Connected
          </span>
        )
      default:
        return (
          <button type="button" onClick={() => act(p.id, () => actions.send(p.id), 'requested')} className="h-10 rounded-lg bg-ember-500 px-4 text-sm font-semibold text-on-accent">Connect</button>
        )
    }
  }

  const requests = people.filter((p) => p.status === 'incoming' || p.status === 'requested')
  const connected = people.filter((p) => p.status === 'connected')
  const viewing = people.find((p) => p.id === viewingId && p.status === 'connected')

  return (
    <>
      <label className="relative block">
        <span className="sr-only">Search people</span>
        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft" />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="none"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or username"
          className="h-12 w-full rounded-xl border border-ink/15 bg-card pr-4 pl-11 text-ink placeholder:text-ink-soft/60 focus:border-ember-700 focus:shadow-[0_0_0_3px_rgba(197,48,48,0.16)] focus:outline-none"
        />
      </label>
      {trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH && (
        <p className="mt-2 text-xs text-ink-soft">Type at least {MIN_QUERY_LENGTH} characters to search.</p>
      )}

      {actionError && (
        <p role="alert" className="mt-4 text-sm font-medium text-ember-700">
          {actionError}
        </p>
      )}

      {trimmed.length >= MIN_QUERY_LENGTH ? (
        <section className="mt-5" aria-live="polite">
          {phase === 'loading' && (
            <ul aria-label="Searching">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex animate-pulse items-center gap-3 py-3">
                  <span className="h-12 w-12 rounded-full bg-sand" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-3 w-1/2 rounded bg-sand" />
                    <span className="block h-3 w-1/3 rounded bg-sand" />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {phase === 'error' && (
            <div className="rounded-xl bg-card p-5 ring-1 ring-ink/10">
              <p className="text-sm text-ink">Search didn’t go through. Check your connection and try again.</p>
              <button type="button" onClick={() => setAttempt((a) => a + 1)} className="mt-3 h-10 rounded-lg bg-sand px-4 text-sm font-semibold text-ember-900">Try again</button>
            </div>
          )}
          {phase === 'done' && results.length === 0 && (
            <div className="py-6 text-center">
              <p className="font-display text-lg font-medium text-ember-900">No one by that name</p>
              <p className="mt-1 text-sm text-ink-soft">Try a username, or part of a display name.</p>
            </div>
          )}
          {phase === 'done' && results.length > 0 && (
            <ul className="divide-y divide-ink/10">
              {results.map((p, i) => (
                <PersonRow key={p.id} person={p} delay={i * 80}>{actionsFor(p)}</PersonRow>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {requests.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display mb-1 text-xl font-medium text-ember-900">Requests</h2>
              <ul className="divide-y divide-ink/10">
                {requests.map((p, i) => (
                  <PersonRow key={p.id} person={p} delay={i * 80}>{actionsFor(p)}</PersonRow>
                ))}
              </ul>
            </section>
          )}

          {connected.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display mb-3 text-xl font-medium text-ember-900">Your connections</h2>
              <ul className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pt-1.5 pb-1">
                {connected.map((p) => (
                  <li key={p.id} className="w-16 shrink-0">
                    <button type="button" onClick={() => setViewingId(p.id)} aria-label={`${p.displayName}, connection details`} className="flex w-full flex-col items-center gap-1.5">
                      <Avatar name={p.displayName} src={personAvatar(p.username, p.avatarUrl ?? undefined)} size={60} className="ring-2 ring-ember-500/40" />
                      <span className="w-full truncate text-center text-xs text-ink-soft">{firstName(p.displayName)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {requests.length === 0 && connected.length === 0 && (
            <div className="mt-10 text-center">
              <p className="font-display text-lg font-medium text-ember-900">No connections yet</p>
              <p className="mt-1 text-sm text-ink-soft">Search for a name or username to send your first request.</p>
            </div>
          )}
        </>
      )}

      {viewing && <FriendSheet person={viewing} onRemove={() => actions.remove(viewing.id)} onClose={() => setViewingId(null)} />}
    </>
  )
}

function PersonRow({ person, children, delay = 0 }: { person: Person; children: ReactNode; delay?: number }) {
  return (
    <li className="animate-rise flex items-center gap-3 py-3" style={{ animationDelay: `${delay}ms` }}>
      <Avatar name={person.displayName} src={personAvatar(person.username, person.avatarUrl ?? undefined)} size={52} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{person.displayName}</p>
        <p className="truncate text-sm text-ink-soft">@{person.username}</p>
        {person.bio && <p className="truncate text-xs text-ink-soft">{person.bio}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </li>
  )
}
