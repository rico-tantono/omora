import type { Collection } from '../types'
import { getSupabase } from '../lib/supabase'
import { hashString } from '../lib/avatar'
import { fail } from './serviceError'

interface CollectionRow {
  id: string
  name: string
  collection_memories: { memory_id: string }[]
}

// Collections have no cover image yet, so each one gets a stable color pair from its id.
const TONES: [string, string][] = [
  ['#FF9A80', '#C53030'],
  ['#FF6B4A', '#7D2020'],
  ['#FFD3C4', '#FF6B4A'],
  ['#8BA889', '#3F5A43'],
]

const toCollection = (row: CollectionRow): Collection => {
  const [from, to] = TONES[hashString(row.id) % TONES.length]
  return { id: row.id, name: row.name, memoryIds: row.collection_memories.map((m) => m.memory_id), from, to }
}

export async function fetchCollections(userId: string): Promise<Collection[]> {
  const { data, error } = await getSupabase()
    .from('collections')
    .select('id, name, collection_memories(memory_id)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw fail(error, 'Couldn’t load your collections.')
  return (data as CollectionRow[]).map(toCollection)
}

export async function createCollection(userId: string, name: string, memoryIds: string[]): Promise<Collection> {
  const client = getSupabase()
  const { data, error } = await client.from('collections').insert({ owner_id: userId, name }).select('id, name').single()
  if (error) throw fail(error, 'Couldn’t create the collection. Please try again.')
  const { id } = data as { id: string }

  if (memoryIds.length > 0) {
    const { error: linkError } = await client
      .from('collection_memories')
      .insert(memoryIds.map((memoryId) => ({ collection_id: id, memory_id: memoryId })))
    if (linkError) {
      await client.from('collections').delete().eq('id', id)
      throw fail(linkError, 'Couldn’t add those memories, so the collection wasn’t created. Please try again.')
    }
  }
  return toCollection({ id, name, collection_memories: memoryIds.map((memory_id) => ({ memory_id })) })
}

export async function addToCollection(collectionId: string, memoryIds: string[]): Promise<void> {
  const { error } = await getSupabase()
    .from('collection_memories')
    .insert(memoryIds.map((memoryId) => ({ collection_id: collectionId, memory_id: memoryId })))
  if (error) throw fail(error, 'Couldn’t add those memories. Please try again.')
}

export async function removeFromCollection(collectionId: string, memoryId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('collection_memories')
    .delete()
    .eq('collection_id', collectionId)
    .eq('memory_id', memoryId)
  if (error) throw fail(error, 'Couldn’t remove that memory. Please try again.')
}
