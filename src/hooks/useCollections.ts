import { useCallback, useEffect, useState } from 'react'
import type { Collection } from '../types'
import { addToCollection, createCollection, fetchCollections, removeFromCollection } from '../services/collections'
import { userMessage } from '../services/serviceError'

// Each action resolves to an error message, or null when it worked, so sheets can show it in place.
export function useCollections(userId: string) {
  const [collections, setCollections] = useState<Collection[]>([])

  useEffect(() => {
    let cancelled = false
    fetchCollections(userId)
      .then((list) => {
        if (!cancelled) setCollections(list)
      })
      .catch(() => {
        // The failure is already logged; an empty list is shown and the next visit retries.
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const create = useCallback(
    async (name: string, memoryIds: string[]): Promise<string | null> => {
      try {
        const collection = await createCollection(userId, name, memoryIds)
        setCollections((list) => [...list, collection])
        return null
      } catch (err) {
        return userMessage(err)
      }
    },
    [userId],
  )

  const add = useCallback(async (collectionId: string, memoryIds: string[]): Promise<string | null> => {
    try {
      await addToCollection(collectionId, memoryIds)
      setCollections((list) =>
        list.map((c) => (c.id === collectionId ? { ...c, memoryIds: [...new Set([...c.memoryIds, ...memoryIds])] } : c)),
      )
      return null
    } catch (err) {
      return userMessage(err)
    }
  }, [])

  const remove = useCallback(async (collectionId: string, memoryId: string): Promise<string | null> => {
    try {
      await removeFromCollection(collectionId, memoryId)
      setCollections((list) =>
        list.map((c) => (c.id === collectionId ? { ...c, memoryIds: c.memoryIds.filter((id) => id !== memoryId) } : c)),
      )
      return null
    } catch (err) {
      return userMessage(err)
    }
  }, [])

  return { collections, create, add, remove }
}
