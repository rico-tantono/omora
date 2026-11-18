import type { CurrentUser, Group, Memory, Person } from '../types'
import { personAvatar } from './avatar'
import { firstName } from './text'
import { visibilityMeta } from './visibility'

// The single place that answers "whose memory is this?".
// The map markers, the preview sheet and the lists all call resolveOwner,
// so ownership is never hardcoded per component.
export interface Directory {
  currentUser: CurrentUser
  people: Person[]
  groups: Group[]
}

export type OwnerKind = 'personal' | 'friend' | 'group'

export interface Identity {
  kind: OwnerKind
  id: string
  name: string
  avatar?: string
  shape: 'circle' | 'squircle'
  /** Short label for chips, e.g. "Group memory" */
  label: string
  /** Longer privacy line for the detail view */
  note: string
  addedByName?: string
}

export function resolveOwner(memory: Memory, dir: Directory): Identity {
  const owner = memory.owner

  if (owner.kind === 'group') {
    const group = dir.groups.find((g) => g.id === owner.groupId)
    const name = group?.name ?? 'Group'
    return {
      kind: 'group',
      id: owner.groupId,
      name,
      avatar: group?.avatar,
      shape: 'squircle',
      label: 'Group memory',
      note: `Visible to members of ${name}`,
      addedByName: addedByName(memory, dir, group),
    }
  }

  if (owner.kind === 'person') {
    const person = dir.people.find((p) => p.id === owner.personId)
    const name = person?.displayName ?? 'A friend'
    return {
      kind: 'friend',
      id: owner.personId,
      name,
      avatar: person ? personAvatar(person.username, person.avatarUrl ?? undefined) : undefined,
      shape: 'circle',
      label: `From ${firstName(name)}`,
      note: 'Shared with you',
    }
  }

  const vis = visibilityMeta[memory.visibility]
  return {
    kind: 'personal',
    id: dir.currentUser.id,
    name: dir.currentUser.displayName,
    avatar: dir.currentUser.avatar,
    shape: 'circle',
    label: 'Your memory',
    note: `${vis.label}: ${vis.hint}`,
  }
}

function addedByName(memory: Memory, dir: Directory, group: Group | undefined): string | undefined {
  if (!memory.addedBy) return undefined
  if (memory.addedBy === 'me') return 'you'
  const author = group?.members.find((m) => m.userId === memory.addedBy) ?? dir.people.find((p) => p.id === memory.addedBy)
  return author ? firstName(author.displayName) : undefined
}

export const isGroupMemory = (m: Memory, groupId: string) => m.owner.kind === 'group' && m.owner.groupId === groupId
export const memoryCountForGroup = (memories: Memory[], groupId: string) =>
  memories.filter((m) => isGroupMemory(m, groupId)).length
