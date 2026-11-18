import { useCallback, useEffect, useState } from 'react'
import type { ConnectionStatus, Person } from '../types'
import {
  cancelFriendRequest,
  fetchFriends,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
} from '../services/friends'
import { userMessage } from '../services/serviceError'
import type { LoadStatus } from './useMemories'

export interface FriendActions {
  /** Resolves to the new relationship, or an error message */
  send: (userId: string) => Promise<{ error: string | null; status?: ConnectionStatus }>
  respond: (requesterId: string, accept: boolean) => Promise<string | null>
  cancel: (addresseeId: string) => Promise<string | null>
  remove: (userId: string) => Promise<string | null>
}

export function useFriends(userId: string) {
  const [people, setPeople] = useState<Person[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(
    async (quiet: boolean) => {
      if (!quiet) {
        setStatus('loading')
        setError(null)
      }
      try {
        setPeople(await fetchFriends(userId))
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

  const actions: FriendActions = {
    send: async (targetId) => {
      try {
        const result = await sendFriendRequest(targetId)
        await reload(true)
        return { error: null, status: result }
      } catch (err) {
        return { error: userMessage(err) }
      }
    },
    respond: (requesterId, accept) => run(() => respondToFriendRequest(requesterId, accept)),
    cancel: (addresseeId) => run(() => cancelFriendRequest(addresseeId)),
    remove: (targetId) => run(() => removeFriend(targetId)),
  }

  return { people, status, error, reload, actions }
}
