import { useCallback, useEffect, useState } from 'react'
import type { Memory, MemorySharing, NewMemoryInput } from '../types'
import { createMemory, deleteMemory, fetchMemories, updateMemorySharing } from '../services/memories'
import { userMessage } from '../services/serviceError'

export type LoadStatus = 'loading' | 'ready' | 'error'

// Photo links last an hour, so the list is quietly reloaded a little before they expire.
const REFRESH_MS = 50 * 60 * 1000

// Every memory you can see: yours, your groups' and your connections'.
export function useMemories(userId: string) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (quiet: boolean) => {
      if (!quiet) {
        setStatus('loading')
        setError(null)
      }
      try {
        setMemories(await fetchMemories(userId))
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
    void load(false)
    const timer = window.setInterval(() => void load(true), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const add = useCallback(
    async (input: NewMemoryInput, photos: File[], groupId: string | null) => {
      const memory = await createMemory(userId, input, photos, groupId)
      setMemories((list) => [memory, ...list])
      return memory
    },
    [userId],
  )

  const setSharing = useCallback(
    async (memoryId: string, sharing: MemorySharing): Promise<string | null> => {
      try {
        await updateMemorySharing(memoryId, sharing)
        await load(true)
        return null
      } catch (err) {
        return userMessage(err)
      }
    },
    [load],
  )

  const remove = useCallback(async (memory: Memory): Promise<string | null> => {
    try {
      await deleteMemory(
        memory.id,
        memory.photos.flatMap((photo) => (photo.path ? [photo.path] : [])),
      )
      setMemories((list) => list.filter((m) => m.id !== memory.id))
      return null
    } catch (err) {
      return userMessage(err)
    }
  }, [])

  return { memories, status, error, reload: (quiet = false) => load(quiet), add, setSharing, remove }
}
