import { useState } from 'react'
import { Calendar, ChevronDown, ChevronUp, Lock, MapPin, Users, X } from 'lucide-react'
import type { Group, Memory, MemorySharing, Photo } from '../types'
import type { Identity } from '../lib/identity'
import { formatDate } from '../lib/format'
import { visibilityMeta } from '../lib/visibility'
import Avatar from './Avatar'
import ConfirmButton from './ConfirmButton'
import { SakuraIcon } from './Motifs'
import PhotoPlaceholder from './PhotoPlaceholder'
import Tag from './Tag'

interface Props {
  memory: Memory
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onClose: () => void
  identity: Identity
  /** Other memories at exactly this spot (includes this one) */
  siblings: Memory[]
  resolve: (m: Memory) => Identity
  onSelectSibling: (m: Memory) => void
  /** True for memories you created; only those can be shared differently */
  canEditSharing: boolean
  groups: Group[]
  /** Resolves to an error message, or null when the change was saved */
  onChangeSharing: (sharing: MemorySharing) => Promise<string | null>
  /** Resolves to an error message, or null when the memory was deleted */
  onDelete: () => Promise<string | null>
}

export default function PlaceSheet({
  memory,
  expanded,
  onExpand,
  onCollapse,
  onClose,
  identity,
  siblings,
  resolve,
  onSelectSibling,
  canEditSharing,
  groups,
  onChangeSharing,
  onDelete,
}: Props) {
  const [favorite, setFavorite] = useState(false)
  const vis = visibilityMeta[memory.visibility]
  const cover = memory.photos[0]
  const NoteIcon = identity.kind === 'personal' ? vis.Icon : Users

  if (!expanded) {
    return (
      <section
        aria-label="Selected memory"
        className="glass-sheet animate-sheet absolute inset-x-0 bottom-0 z-[1100] rounded-t-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink/15" />
        <button
          type="button"
          onClick={onExpand}
          aria-label={`Open memory: ${memory.title}`}
          className="flex w-full items-center gap-3 px-4 pt-3 pr-14 pb-4 text-left"
        >
          {cover ? (
            <PhotoPlaceholder from={cover.from} to={cover.to} src={cover.url} className="h-16 w-16 shrink-0 rounded-xl" />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-ember-200 text-ember-900">
              <MapPin size={24} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <OwnerLine identity={identity} />
            <p className="font-display line-clamp-2 text-[1.05rem] leading-snug font-medium text-ink">{memory.title}</p>
            <p className="mt-0.5 truncate text-sm text-ink-soft">{memory.placeName}</p>
            <div className="mt-1.5 flex gap-1.5 overflow-hidden">
              {memory.tags.slice(0, 2).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </div>
          <ChevronUp size={22} className="shrink-0 text-ember-500" aria-hidden="true" />
        </button>
        {siblings.length > 1 && (
          <SiblingStrip siblings={siblings} selectedId={memory.id} resolve={resolve} onSelect={onSelectSibling} />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full text-ink-soft"
        >
          <X size={20} />
        </button>
      </section>
    )
  }

  return (
    <section
      aria-label="Memory detail"
      className="animate-sheet absolute inset-x-0 bottom-0 z-[1100] flex max-h-[88%] flex-col overflow-hidden rounded-t-2xl bg-paper shadow-sheet"
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-3">
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Back to map"
          className="glass grid h-11 w-11 place-items-center rounded-full text-ink"
        >
          <ChevronDown size={22} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close memory"
          className="glass grid h-11 w-11 place-items-center rounded-full text-ink"
        >
          <X size={20} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
        <Hero photos={memory.photos} />

        <div className="relative -mt-12 px-5">
          <OwnerChip identity={identity} />
          <h2 className="font-display text-[1.65rem] leading-tight font-medium text-ember-900">{memory.title}</h2>

          <dl className="mt-3 space-y-1.5 text-sm text-ink-soft">
            <div className="flex items-start gap-2">
              <dt className="sr-only">Place</dt>
              <MapPin size={16} className="mt-0.5 shrink-0 text-ember-500" />
              <dd className="min-w-0">
                <span className="font-medium text-ink">{memory.placeName}</span>
                <span className="block">{memory.area}</span>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Visited</dt>
              <Calendar size={16} className="shrink-0 text-ember-500" />
              <dd>{formatDate(memory.visitDate)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Visibility</dt>
              <NoteIcon size={16} className="shrink-0 text-ember-500" />
              <dd>{identity.note}</dd>
            </div>
          </dl>

          {memory.story && <p className="font-display mt-5 text-[1.05rem] leading-relaxed text-ink">{memory.story}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            {memory.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>

          {canEditSharing && (
            <>
              <SharingControl memory={memory} groups={groups} onChange={onChangeSharing} />
              <DeleteMemory onDelete={onDelete} />
            </>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setFavorite((f) => !f)}
              aria-pressed={favorite}
              className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-lg font-semibold ${
                favorite ? 'bg-ember-500 text-on-accent' : 'bg-sand text-ember-900'
              }`}
            >
              <SakuraIcon className="h-6 w-6" filled={favorite} strokeWidth={6} />
              {favorite ? 'Favorited' : 'Favorite'}
            </button>
            <button
              type="button"
              onClick={onCollapse}
              className="h-12 flex-1 rounded-lg border border-ink/15 font-semibold text-ember-900"
            >
              Back to map
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// Full-width photo area that dissolves into the page color at the bottom.
function Hero({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState(0)
  const slides = photos.length > 0 ? photos : [{ id: 'empty', from: '#FFD6C7', to: '#FF6B4A' }]

  return (
    <div className="relative">
      <div
        onScroll={(e) => {
          const el = e.currentTarget
          setIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)))
        }}
        className="fade-bottom no-scrollbar flex h-64 snap-x snap-mandatory overflow-x-auto"
      >
        {slides.map((p) => (
          <PhotoPlaceholder key={p.id} from={p.from} to={p.to} src={p.url} className="h-full w-full shrink-0 snap-center" />
        ))}
      </div>
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center gap-1.5" aria-hidden="true">
          {photos.map((p, i) => (
            <span
              key={p.id}
              className={`h-1.5 rounded-full bg-card transition-all duration-[350ms] ${i === index ? 'w-4 opacity-95' : 'w-1.5 opacity-60'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OwnerLine({ identity }: { identity: Identity }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-soft">
      <Avatar name={identity.name} src={identity.avatar} shape={identity.shape} size={18} />
      <span className="truncate">{identity.kind === 'group' ? identity.name : identity.label}</span>
    </div>
  )
}

// Larger owner chip in the detail view; sits on the photo fade, so it has a backing
function OwnerChip({ identity }: { identity: Identity }) {
  const sub =
    identity.kind === 'group'
      ? `Group memory${identity.addedByName ? `, added by ${identity.addedByName}` : ''}`
      : identity.kind === 'friend'
        ? 'Shared with you'
        : 'On your personal map'
  return (
    <div className="mb-3 inline-flex max-w-full items-center gap-2.5 rounded-full bg-paper/85 py-1 pr-4 pl-1">
      <Avatar name={identity.name} src={identity.avatar} shape={identity.shape} size={34} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-ink">{identity.kind === 'personal' ? 'You' : identity.name}</p>
        <p className="truncate text-xs text-ink-soft">{sub}</p>
      </div>
    </div>
  )
}

function SiblingStrip({
  siblings,
  selectedId,
  resolve,
  onSelect,
}: {
  siblings: Memory[]
  selectedId: string
  resolve: (m: Memory) => Identity
  onSelect: (m: Memory) => void
}) {
  return (
    <div role="group" aria-label={`${siblings.length} memories at this place`} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4">
      {siblings.map((m) => {
        const id = resolve(m)
        const on = m.id === selectedId
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m)}
            aria-pressed={on}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg pr-3 pl-1.5 text-xs font-semibold transition-colors duration-[350ms] ${
              on ? 'bg-ember-500 text-on-accent' : 'bg-card/80 text-ink ring-1 ring-ink/10'
            }`}
          >
            <Avatar name={id.name} src={id.avatar} shape={id.shape} size={24} />
            <span className="max-w-[9rem] truncate">{m.title}</span>
          </button>
        )
      })}
    </div>
  )
}

// Choose who sees a memory you created: only you, your connections, or one of your groups.
function SharingControl({
  memory,
  groups,
  onChange,
}: {
  memory: Memory
  groups: Group[]
  onChange: (sharing: MemorySharing) => Promise<string | null>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const current = memory.owner.kind === 'group' ? memory.owner.groupId : memory.visibility

  async function choose(id: string, sharing: MemorySharing) {
    if (id === current) return
    setBusy(true)
    setError('')
    const message = await onChange(sharing)
    setBusy(false)
    if (message) setError(message)
  }

  const chip = (on: boolean) =>
    `flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 transition-colors duration-[350ms] disabled:opacity-60 ${
      on ? 'bg-sage/20 text-ink ring-sage-deep' : 'bg-card text-ink ring-ink/10'
    }`

  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-semibold">Who can see this</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} aria-pressed={current === 'private'} onClick={() => choose('private', { groupId: null, visibility: 'private' })} className={chip(current === 'private')}>
          <Lock size={14} /> Only me
        </button>
        <button type="button" disabled={busy} aria-pressed={current === 'connections'} onClick={() => choose('connections', { groupId: null, visibility: 'connections' })} className={chip(current === 'connections')}>
          <Users size={14} /> Connections
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            disabled={busy}
            aria-pressed={current === group.id}
            onClick={() => choose(group.id, { groupId: group.id, visibility: 'private' })}
            className={chip(current === group.id)}
          >
            <Avatar name={group.name} src={group.avatar} shape="squircle" size={20} />
            <span className="max-w-[9rem] truncate">{group.name}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-ember-700">
          {error}
        </p>
      )}
    </div>
  )
}

function DeleteMemory({ onDelete }: { onDelete: () => Promise<string | null> }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    <div className="mt-5">
      <ConfirmButton
        label="Delete memory"
        confirmLabel="Tap again to delete for good"
        active={confirming}
        busy={busy}
        onArm={() => setConfirming(true)}
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-ember-700">
          {error}
        </p>
      )}
    </div>
  )
}
