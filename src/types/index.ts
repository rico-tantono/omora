export type Visibility = 'public' | 'connections' | 'private'

export interface Photo {
  id: string
  // Placeholder "photos" are gradient tones now; swap for image URLs later
  from: string
  to: string
  caption?: string
  /** Real photo (a signed link for private photos). Without it the gradient is shown. */
  url?: string
  /** Where the file is kept in storage */
  path?: string
}

// Who a memory belongs to. The map and the preview both resolve this the same way.
export type MemoryOwner =
  | { kind: 'me' }
  | { kind: 'person'; personId: string }
  | { kind: 'group'; groupId: string }

export interface Memory {
  id: string
  title: string
  placeName: string
  area: string
  lat: number
  lng: number
  story: string
  visitDate: string // ISO date, YYYY-MM-DD
  tags: string[]
  visibility: Visibility
  photos: Photo[]
  owner: MemoryOwner
  /** The person who created the memory, even when it is shared with a group */
  authorId: string
  /** Who added it, for group memories: 'me' or a person id */
  addedBy?: string
}

/** What the add-memory form collects; the owner and id are added when it is saved. */
export interface NewMemoryInput {
  title: string
  placeName: string
  area: string
  lat: number
  lng: number
  story: string
  visitDate: string
  tags: string[]
  visibility: Visibility
}

/** Who a memory is shared with: a group, or else everyone you are connected with, or nobody */
export interface MemorySharing {
  groupId: string | null
  visibility: 'private' | 'connections'
}

export type AvatarChange = { kind: 'upload'; file: File } | { kind: 'remove' }

export interface Collection {
  id: string
  name: string
  memoryIds: string[]
  from: string
  to: string
}

export interface CurrentUser {
  id: 'me'
  username: string
  displayName: string
  avatar: string
}

export interface Profile {
  id: string
  username: string
  displayName: string
  bio: string
  avatarUrl: string | null
  /** Who can find this profile in search */
  visibility: Visibility
}

export type ProfileChanges = Pick<Profile, 'username' | 'displayName' | 'bio'>

export type ConnectionStatus = 'none' | 'requested' | 'incoming' | 'connected'

export interface Person {
  id: string
  username: string
  displayName: string
  bio: string
  status: ConnectionStatus
  /** Custom picture; without one the default (colored by username) is used */
  avatarUrl: string | null
}

export type GroupAvatarKey = 'ember' | 'moss' | 'rose' | 'dusk'

export interface GroupMember {
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: 'owner' | 'member'
  status: 'member' | 'invited'
}

// A group is a persistent set of people with one shared map.
export interface Group {
  id: string
  name: string
  description: string
  /** The picture to show: an uploaded photo or a preset. Without one the UI shows initials. */
  avatar?: string
  avatarKey: GroupAvatarKey | null
  avatarUrl: string | null
  ownerId: string
  /** Whether you are in the group, or have only been invited */
  myStatus: 'member' | 'invited'
  /** Display name of whoever invited you, while the invitation is open */
  invitedBy?: string
  members: GroupMember[]
}

/** What to do with a group's picture when saving */
export type GroupAvatarChoice =
  | { kind: 'keep' }
  | { kind: 'preset'; key: GroupAvatarKey }
  | { kind: 'upload'; file: File }
  | { kind: 'none' }

export type TabId = 'map' | 'connections' | 'updates' | 'me'
