import { getSupabase } from '../lib/supabase'
import { fail } from './serviceError'
import { AVATAR_BUCKET, PHOTO_BUCKET, removeFiles } from './storage'

const MAX_FOLDER_DEPTH = 3

// Storage lists one folder at a time: files have an id, folders do not.
async function listFiles(bucket: string, folder: string, depth = 0): Promise<string[]> {
  if (depth > MAX_FOLDER_DEPTH) return []
  const { data, error } = await getSupabase().storage.from(bucket).list(folder, { limit: 1000 })
  if (error || !data) return []

  const paths: string[] = []
  for (const item of data) {
    const path = `${folder}/${item.name}`
    if (item.id) paths.push(path)
    else paths.push(...(await listFiles(bucket, path, depth + 1)))
  }
  return paths
}

// Deletes the account and everything in it. The files are found first, the account is deleted next, and the
// files are removed last: if the deletion fails, nothing has been lost, and a failed file cleanup only leaves
// unreachable files behind.
export async function deleteAccount(userId: string): Promise<void> {
  const photos = await listFiles(PHOTO_BUCKET, userId)
  const pictures = await listFiles(AVATAR_BUCKET, userId)

  const { error } = await getSupabase().rpc('delete_my_account')
  if (error) throw fail(error, 'Couldn’t delete your account. Please try again.')

  await removeFiles(PHOTO_BUCKET, photos)
  await removeFiles(AVATAR_BUCKET, pictures)
}
