import { useEffect, useMemo, useRef, useState } from 'react'
import type { AvatarChange, CurrentUser, Memory, NewMemoryInput, Profile, ProfileChanges, TabId, Visibility } from './types'
import type { Directory } from './lib/identity'
import { personAvatar } from './lib/avatar'
import { useCollections } from './hooks/useCollections'
import { useFriends } from './hooks/useFriends'
import { useGroups } from './hooks/useGroups'
import { useMemories } from './hooks/useMemories'
import BottomNav from './components/BottomNav'
import MyMapPage from './pages/MyMapPage'
import ConnectionsPage from './pages/ConnectionsPage'
import UpdatesPage from './pages/UpdatesPage'
import MePage from './pages/MePage'

interface Props {
  profile: Profile
  onSaveProfile: (changes: ProfileChanges, avatar?: AvatarChange) => Promise<string | null>
  onSaveVisibility: (visibility: Visibility) => Promise<string | null>
  onDeleteAccount: () => Promise<string | null>
  onLogout: () => void
}

export default function MainApp({ profile, onSaveProfile, onSaveVisibility, onDeleteAccount, onLogout }: Props) {
  const [tab, setTab] = useState<TabId>('map')
  const all = useMemories(profile.id)
  const collections = useCollections(profile.id)
  const groups = useGroups(profile.id)
  const friends = useFriends(profile.id)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [groupFilterId, setGroupFilterId] = useState<string | null>(null)

  // Everything you can see goes on the map; the ones you created are listed on your profile.
  const authored = useMemo(() => all.memories.filter((m) => m.authorId === profile.id), [all.memories, profile.id])
  const friendRequests = useMemo(() => friends.people.filter((p) => p.status === 'incoming'), [friends.people])
  const groupInvites = useMemo(() => groups.groups.filter((g) => g.myStatus === 'invited'), [groups.groups])
  const waitingCount = friendRequests.length + groupInvites.length

  // Requests and invitations can arrive at any time, so they are refreshed whenever one of these tabs opens.
  const reloadGroups = groups.reload
  const reloadFriends = friends.reload
  const reloadMemories = all.reload
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (tab === 'connections' || tab === 'updates') {
      void reloadGroups(true)
      void reloadFriends(true)
    }
    // Friends and groups may have shared new memories since you last looked.
    if (tab === 'map' || tab === 'me') void reloadMemories(true)
  }, [tab, reloadGroups, reloadFriends, reloadMemories])

  // One source of identity for Connections, the map pins and the previews
  const directory = useMemo<Directory>(() => {
    const currentUser: CurrentUser = {
      id: 'me',
      username: profile.username,
      displayName: profile.displayName,
      avatar: personAvatar(profile.username, profile.avatarUrl ?? undefined),
    }
    return { currentUser, people: friends.people, groups: groups.groups }
  }, [profile, friends.people, groups.groups])

  const addMemory = (input: NewMemoryInput, groupId: string | null, photos: File[]): Promise<Memory> =>
    all.add(input, photos, groupId)

  function openMemoryOnMap(id: string) {
    setGroupFilterId(null)
    setFocusId(id)
    setTab('map')
  }

  function openGroupMap(groupId: string) {
    setGroupFilterId(groupId)
    setTab('map')
  }

  return (
    <div className="app-bg animate-fade flex h-dvh flex-col overflow-hidden">
      <main className="relative min-h-0 flex-1">
        {/* The map stays mounted (just hidden) so it keeps its position between tabs */}
        <div className={tab === 'map' ? 'h-full' : 'hidden'}>
          <MyMapPage
            active={tab === 'map'}
            memories={all.memories}
            directory={directory}
            groupFilterId={groupFilterId}
            onClearGroupFilter={() => setGroupFilterId(null)}
            onAddMemory={addMemory}
            onChangeSharing={all.setSharing}
            onDeleteMemory={all.remove}
            currentUserId={profile.id}
            loading={all.status === 'loading'}
            loadError={all.error}
            onRetryLoad={() => all.reload()}
            focusId={focusId}
            onFocusHandled={() => setFocusId(null)}
          />
        </div>

        {tab === 'connections' && (
          <ConnectionsPage
            currentUserId={profile.id}
            people={friends.people}
            friendActions={friends.actions}
            groups={groups.groups}
            groupActions={groups.actions}
            memories={all.memories}
            onOpenGroupMap={openGroupMap}
          />
        )}

        {tab === 'updates' && (
          <UpdatesPage
            friendRequests={friendRequests}
            groupInvites={groupInvites}
            friendActions={friends.actions}
            groupActions={groups.actions}
          />
        )}

        {tab === 'me' && (
          <MePage
            profile={profile}
            avatar={directory.currentUser.avatar}
            connectionCount={friends.people.filter((p) => p.status === 'connected').length}
            memories={authored}
            collections={collections.collections}
            onOpenMemory={openMemoryOnMap}
            onLogout={onLogout}
            onSaveProfile={onSaveProfile}
            onSaveVisibility={onSaveVisibility}
            onDeleteAccount={onDeleteAccount}
            onCreateCollection={collections.create}
            onAddToCollection={collections.add}
            onRemoveFromCollection={collections.remove}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} unreadCount={waitingCount} />
    </div>
  )
}
