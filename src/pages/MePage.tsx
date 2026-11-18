import { useMemo, useState } from 'react'
import { Check, Pencil, Plus, Settings, X } from 'lucide-react'
import type { AvatarChange, Collection, Memory, Profile, ProfileChanges, Visibility } from '../types'
import { profileVisibilityMeta, visibilityOrder } from '../lib/visibility'
import { memoriesOnThisDay } from '../lib/onThisDay'
import Avatar from '../components/Avatar'
import PhotoPlaceholder from '../components/PhotoPlaceholder'
import { SakuraIcon } from '../components/Motifs'
import OnThisDay from '../components/OnThisDay'
import EditProfileSheet from '../components/EditProfileSheet'
import CollectionSheet from '../components/CollectionSheet'
import NewCollectionSheet from '../components/NewCollectionSheet'
import DeleteAccountSheet from '../components/DeleteAccountSheet'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  profile: Profile
  avatar: string
  connectionCount: number
  /** The user's own memories */
  memories: Memory[]
  collections: Collection[]
  onOpenMemory: (id: string) => void
  onLogout: () => void
  onSaveProfile: (changes: ProfileChanges, avatar?: AvatarChange) => Promise<string | null>
  onSaveVisibility: (visibility: Visibility) => Promise<string | null>
  /** Resolves to an error message; on success you are signed out */
  onDeleteAccount: () => Promise<string | null>
  /** Collection actions resolve to an error message, or null when they worked */
  onCreateCollection: (name: string, memoryIds: string[]) => Promise<string | null>
  onAddToCollection: (collectionId: string, memoryIds: string[]) => Promise<string | null>
  onRemoveFromCollection: (collectionId: string, memoryId: string) => Promise<string | null>
}

export default function MePage({
  profile,
  avatar,
  connectionCount,
  memories,
  collections,
  onOpenMemory,
  onLogout,
  onSaveProfile,
  onSaveVisibility,
  onDeleteAccount,
  onCreateCollection,
  onAddToCollection,
  onRemoveFromCollection,
}: Props) {
  const [visibilityError, setVisibilityError] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editing, setEditing] = useState(false)
  const [openCollectionId, setOpenCollectionId] = useState<string | null>(null)
  const [creatingCollection, setCreatingCollection] = useState(false)
  useEscapeKey(showSettings && !deletingAccount ? () => setShowSettings(false) : undefined)
  const vis = profileVisibilityMeta[profile.visibility]

  const todays = useMemo(() => memoriesOnThisDay(memories), [memories])
  const openCollection = collections.find((c) => c.id === openCollectionId) ?? null

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="surface-organic pt-safe px-5 pb-10">
        <SakuraIcon filled={false} strokeWidth={2.6} className="pointer-events-none absolute -right-10 bottom-0 -z-10 h-48 w-48 rotate-12 text-white/20" />
        {/* Two hairline pillars near the screen edges; they continue below the stats beam */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 w-px bg-white/20" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 w-px bg-white/20" />
        <div className="flex justify-end pt-3">
          <button type="button" onClick={() => setShowSettings(true)} aria-label="Open settings" className="grid h-11 w-11 place-items-center rounded-full bg-white/20">
            <Settings size={20} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="rounded-full ring-4 ring-white/70">
            <Avatar name={profile.displayName} src={avatar} size={76} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-[1.7rem] leading-tight font-medium">{profile.displayName}</h1>
            <p className="truncate text-sm text-white/85">@{profile.username}</p>
          </div>
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit profile details" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20">
            <Pencil size={18} />
          </button>
        </div>

        {profile.bio && <p className="mt-4 text-[0.95rem] leading-relaxed text-white/95">{profile.bio}</p>}
        <button type="button" onClick={() => setShowSettings(true)} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-white/20 px-4 text-sm font-medium">
          <vis.Icon size={15} /> Profile: {vis.label}
        </button>
      </div>

      {/* The stats card is the lower crossbeam (nuki). A tiny strut above it and the pillar feet below complete the gate. */}
      <div className="relative -mt-5">
        <span aria-hidden="true" className="pointer-events-none absolute -top-3.5 left-1/2 h-3.5 w-px bg-white/35" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-5 -bottom-14 left-3 w-px"
          style={{ background: 'linear-gradient(to bottom, rgba(197,48,48,0.2), rgba(197,48,48,0))' }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-5 -bottom-14 right-3 w-px"
          style={{ background: 'linear-gradient(to bottom, rgba(197,48,48,0.2), rgba(197,48,48,0))' }}
        />
        <div className="relative mx-5 grid grid-cols-3 rounded-lg bg-card py-4 text-center shadow-float ring-1 ring-ink/10">
          <Stat value={memories.length} label="Memories" />
          <Stat value={new Set(memories.map((m) => m.area)).size} label="Areas" />
          <Stat value={connectionCount} label="Connections" />
        </div>
      </div>

      <OnThisDay memories={todays} onOpen={onOpenMemory} />

      <section className="mt-8">
        <h2 className="font-display px-5 text-xl font-medium text-ember-900">Collections</h2>
        <ul className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
          {collections.map((c) => {
            const count = c.memoryIds.filter((id) => memories.some((m) => m.id === id)).length
            return (
              <li key={c.id} className="w-40 shrink-0">
                <button type="button" onClick={() => setOpenCollectionId(c.id)} className="block w-full text-left" aria-label={`Open collection ${c.name}`}>
                  <PhotoPlaceholder from={c.from} to={c.to} className="h-24 rounded-lg" />
                  <p className="mt-2 truncate font-semibold">{c.name}</p>
                  <p className="text-sm text-ink-soft">{count === 1 ? '1 memory' : `${count} memories`}</p>
                </button>
              </li>
            )
          })}
          <li className="w-32 shrink-0">
            <button
              type="button"
              onClick={() => setCreatingCollection(true)}
              className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-ember-500/50 text-sm font-semibold text-ember-700"
            >
              <Plus size={20} />
              New collection
            </button>
          </li>
        </ul>
      </section>

      <section className="mt-8 px-5 pb-6">
        <h2 className="font-display text-xl font-medium text-ember-900">Recent memories</h2>
        {memories.length === 0 ? (
          <p className="mt-3 rounded-lg bg-sand p-5 text-sm text-ink-soft">Memories you save from My Map will appear here.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {[...memories]
              .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
              .slice(0, 6)
              .map((m) => {
                const cover = m.photos[0]
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => onOpenMemory(m.id)} className="block w-full text-left">
                      <PhotoPlaceholder from={cover?.from ?? '#F0E7D5'} to={cover?.to ?? '#FFD3C4'} src={cover?.url} className="aspect-[4/5] rounded-lg" />
                      <p className="font-display mt-2 line-clamp-2 leading-snug font-medium">{m.title}</p>
                      <p className="truncate text-sm text-ink-soft">{m.placeName}</p>
                    </button>
                  </li>
                )
              })}
          </ul>
        )}
      </section>

      <footer className="px-5 pt-2 pb-8 text-center text-xs text-ink-soft">© 2026 OMORA. Personal project.</footer>

      {editing && (
        <EditProfileSheet
          initial={{ displayName: profile.displayName, username: profile.username, bio: profile.bio }}
          currentAvatarUrl={profile.avatarUrl}
          onSave={async (edits, avatar) => {
            const error = await onSaveProfile(edits, avatar)
            if (!error) setEditing(false)
            return error
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {openCollection && (
        <CollectionSheet
          collection={openCollection}
          memories={memories}
          onAdd={(ids) => onAddToCollection(openCollection.id, ids)}
          onRemove={(id) => onRemoveFromCollection(openCollection.id, id)}
          onOpenMemory={(id) => {
            setOpenCollectionId(null)
            onOpenMemory(id)
          }}
          onClose={() => setOpenCollectionId(null)}
        />
      )}

      {creatingCollection && (
        <NewCollectionSheet
          memories={memories}
          onCreate={async (name, ids) => {
            const error = await onCreateCollection(name, ids)
            if (!error) setCreatingCollection(false)
            return error
          }}
          onClose={() => setCreatingCollection(false)}
        />
      )}

      {deletingAccount && (
        <DeleteAccountSheet username={profile.username} onDelete={onDeleteAccount} onClose={() => setDeletingAccount(false)} />
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[1400] flex items-end bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="animate-sheet pb-safe max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-paper">
            <div className="flex items-center justify-between px-5 pt-5">
              <h2 className="font-display text-xl font-medium text-ember-900">Settings</h2>
              <button type="button" onClick={() => setShowSettings(false)} aria-label="Close settings" className="grid h-10 w-10 place-items-center rounded-full bg-sand">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 px-5 py-5">
              <fieldset>
                <legend className="font-bold">Who can find your profile</legend>
                <div className="mt-3 space-y-2">
                  {visibilityOrder.map((v) => {
                    const { label, hint, Icon } = profileVisibilityMeta[v]
                    const on = profile.visibility === v
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={async () => {
                          setVisibilityError('')
                          setVisibilityError((await onSaveVisibility(v)) ?? '')
                        }}
                        aria-pressed={on}
                        className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl px-4 py-2 text-left ${on ? 'bg-sage text-ink' : 'bg-sand text-ember-900'}`}
                      >
                        <Icon size={18} />
                        <span className="flex-1">
                          <span className="block font-bold">{label}</span>
                          <span className={`block text-xs ${on ? 'text-ink/70' : 'text-ink-soft'}`}>{hint}</span>
                        </span>
                        {on && <Check size={18} />}
                      </button>
                    )
                  })}
                </div>
                {visibilityError && (
                  <p role="alert" className="mt-2 text-sm font-medium text-ember-700">
                    {visibilityError}
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-soft">Each memory has its own setting for who can see it.</p>
              </fieldset>

              <button type="button" onClick={onLogout} className="h-12 w-full rounded-xl border border-ink/15 font-semibold text-ember-900">
                Log out
              </button>

              <button type="button" onClick={() => setDeletingAccount(true)} className="h-11 w-full rounded-xl text-sm font-semibold text-ember-700">
                Delete account
              </button>

              <p className="text-sm text-ink-soft">Theme: light and dark options are decided in the finalization stage.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-medium text-ember-900">{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  )
}
