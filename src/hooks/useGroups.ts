import { useCallback, useEffect, useState } from 'react'
import type { Group } from '../types'
import {
  createGroup,
  deleteGroup,
  fetchGroups,
  inviteToGroup,
  leaveGroup,
  removeGroupMember,
  respondToInvite,
  updateGroup,
  type GroupDetails,
  type InviteFailure,
} from '../services/groups'
import { userMessage } from '../services/serviceError'
import type { LoadStatus } from './useMemories'

export interface GroupActions {
  create: (details: GroupDetails, usernames: string[]) => Promise<{ error: string | null; inviteFailures: InviteFailure[] }>
  update: (group: Group, details: GroupDetails) => Promise<string | null>
  remove: (group: Group) => Promise<string | null>
  invite: (groupId: string, username: string) => Promise<string | null>
  respond: (groupId: string, accept: boolean) => Promise<string | null>
  leave: (groupId: string) => Promise<string | null>
  removeMember: (groupId: string, userId: string) => Promise<string | null>
}

export function useGroups(userId: string) {
  const [groups, setGroups] = useState<Group[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  // A quiet reload keeps what is on screen instead of showing a loading state.
  const reload = useCallback(
    async (quiet: boolean) => {
      if (!quiet) {
        setStatus('loading')
        setError(null)
      }
      try {
        setGroups(await fetchGroups(userId))
        setStatus('ready')
      } catch (err) {
        if (quiet) return
        setError(userMessage(err))
        setStatus('error')
      }
    },
    [userId],
  )

  useEffect(() => {
    void reload(false)
  }, [reload])

  // Every change is followed by a reload so the screen always shows what the database holds.
  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<string | null> => {
      try {
        await action()
        await reload(true)
        return null
      } catch (err) {
        return userMessage(err)
      }
    },
    [reload],
  )

  const actions: GroupActions = {
    create: async (details, usernames) => {
      try {
        const { inviteFailures } = await createGroup(userId, details, usernames)
        await reload(true)
        return { error: null, inviteFailures }
      } catch (err) {
        return { error: userMessage(err), inviteFailures: [] }
      }
    },
    update: (group, details) => run(() => updateGroup(group, details)),
    remove: (group) => run(() => deleteGroup(group)),
    invite: (groupId, username) => run(() => inviteToGroup(groupId, username)),
    respond: (groupId, accept) => run(() => respondToInvite(groupId, accept)),
    leave: (groupId) => run(() => leaveGroup(groupId)),
    removeMember: (groupId, memberId) => run(() => removeGroupMember(groupId, memberId)),
  }

  return { groups, status, error, reload, actions }
}
