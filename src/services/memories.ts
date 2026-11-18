import type { Memory, MemorySharing, NewMemoryInput, Visibility } from '../types'
import { getSupabase } from '../lib/supabase'
import { randomId } from '../lib/id'
import { PHOTO_MAX_EDGE, ImageError, prepareImage } from '../lib/imageProcessing'
import { fail, ServiceError } from './serviceError'
import { PHOTO_BUCKET, removeFiles, signPhotoUrls, uploadJpeg } from './storage'

const COLUMNS =
  'id, owner_id, group_id, title, story, place_name, area, lat, lng, visit_date, tags, visibility, memory_photos(id, storage_path, caption, position)'

// Shown until a photo loads, and as the fallback if it never does.
const PHOTO_TONE = { from: '#F0E7D5', to: '#FFD3C4' }

interface PhotoRow {
  id: string
  storage_path: string
  caption: string | null
  position: number
}

interface MemoryRow {
  id: string
  owner_id: string
  group_id: string | null
  title: string
  story: string
  place_name: string
  area: string
  lat: number
  lng: number
  visit_date: string
  tags: string[]
  visibility: Visibility
  memory_photos: PhotoRow[]
}

// Memories come back from the database in three kinds: shared with a group, your own, or a connection's.
function toMemory(row: MemoryRow, urls: Map<string, string>, myId: string): Memory {
  const mine = row.owner_id === myId
  return {
    id: row.id,
    authorId: row.owner_id,
    owner: row.group_id ? { kind: 'group', groupId: row.group_id } : mine ? { kind: 'me' } : { kind: 'person', personId: row.owner_id },
    addedBy: row.group_id ? (mine ? 'me' : row.owner_id) : undefined,
    title: row.title,
    story: row.story,
    placeName: row.place_name,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
    visitDate: row.visit_date,
    tags: row.tags,
    visibility: row.visibility,
    photos: [...row.memory_photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({
        id: photo.id,
        ...PHOTO_TONE,
        caption: photo.caption ?? undefined,
        url: urls.get(photo.storage_path),
        path: photo.storage_path,
      })),
  }
}

// Everything you are allowed to see: your own memories, your groups' and your connections'.
export async function fetchMemories(userId: string): Promise<Memory[]> {
  try {
    const { data, error } = await getSupabase()
      .from('memories')
      .select(COLUMNS)
      .order('visit_date', { ascending: false })
    if (error) throw error

    const rows = data as MemoryRow[]
    const urls = await signPhotoUrls(rows.flatMap((row) => row.memory_photos.map((photo) => photo.storage_path)))
    return rows.map((row) => toMemory(row, urls, userId))
  } catch (error) {
    throw fail(error, 'Couldn’t load your memories. Check your connection and try again.')
  }
}

// Saves the memory and its photos together: if a photo fails, nothing is kept.
export async function createMemory(
  userId: string,
  input: NewMemoryInput,
  photos: File[],
  groupId: string | null = null,
): Promise<Memory> {
  const client = getSupabase()

  let prepared: Blob[]
  try {
    prepared = await Promise.all(photos.map((file) => prepareImage(file, PHOTO_MAX_EDGE)))
  } catch (error) {
    throw error instanceof ImageError ? new ServiceError(error.message) : fail(error, 'Couldn’t process your photos.')
  }

  const { data: created, error: insertError } = await client
    .from('memories')
    .insert({
      owner_id: userId,
      title: input.title,
      story: input.story,
      place_name: input.placeName,
      area: input.area,
      lat: input.lat,
      lng: input.lng,
      visit_date: input.visitDate,
      tags: input.tags,
      group_id: groupId,
      visibility: groupId ? 'private' : input.visibility,
    })
    .select('id')
    .single()
  if (insertError) throw fail(insertError, 'Couldn’t save your memory. Please try again.')
  const memoryId = (created as { id: string }).id

  const uploaded: string[] = []
  let photoRows: PhotoRow[] = []
  try {
    for (const blob of prepared) {
      const path = `${userId}/${memoryId}/${randomId()}.jpg`
      await uploadJpeg(PHOTO_BUCKET, path, blob)
      uploaded.push(path)
    }
    if (uploaded.length > 0) {
      const { data, error } = await client
        .from('memory_photos')
        .insert(uploaded.map((path, position) => ({ memory_id: memoryId, owner_id: userId, storage_path: path, position })))
        .select('id, storage_path, caption, position')
      if (error) throw error
      photoRows = data as PhotoRow[]
    }
  } catch (error) {
    await client.from('memories').delete().eq('id', memoryId)
    await removeFiles(PHOTO_BUCKET, uploaded)
    throw fail(error, 'Your photos couldn’t be uploaded, so the memory wasn’t saved. Please try again.')
  }

  let urls = new Map<string, string>()
  try {
    urls = await signPhotoUrls(uploaded)
  } catch (error) {
    console.warn('Could not create photo links; they will appear after the next refresh.', error)
  }
  return toMemory({ ...mapInput(memoryId, userId, groupId, input), memory_photos: photoRows }, urls, userId)
}

function mapInput(id: string, userId: string, groupId: string | null, input: NewMemoryInput): Omit<MemoryRow, 'memory_photos'> {
  return {
    id,
    owner_id: userId,
    group_id: groupId,
    title: input.title,
    story: input.story,
    place_name: input.placeName,
    area: input.area,
    lat: input.lat,
    lng: input.lng,
    visit_date: input.visitDate,
    tags: input.tags,
    visibility: groupId ? 'private' : input.visibility,
  }
}

// Changes who can see a memory you created. Group memories keep "private" as their base visibility,
// so removing one from its group never exposes it more widely.
export async function updateMemorySharing(memoryId: string, sharing: MemorySharing): Promise<void> {
  const { error } = await getSupabase()
    .from('memories')
    .update({ group_id: sharing.groupId, visibility: sharing.groupId ? 'private' : sharing.visibility })
    .eq('id', memoryId)
  if (error) throw fail(error, 'Couldn’t change who can see this memory. Please try again.')
}

// Deletes a memory you created. Its photo rows go with it; the files are removed from storage afterwards.
export async function deleteMemory(memoryId: string, photoPaths: string[]): Promise<void> {
  const { error } = await getSupabase().from('memories').delete().eq('id', memoryId)
  if (error) throw fail(error, 'Couldn’t delete the memory. Please try again.')
  await removeFiles(PHOTO_BUCKET, photoPaths)
}
