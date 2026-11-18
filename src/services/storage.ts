import { getSupabase, supabaseUrl } from '../lib/supabase'

export const AVATAR_BUCKET = 'avatars'
export const PHOTO_BUCKET = 'memory-photos'

const SIGNED_URL_SECONDS = 60 * 60
const PUBLIC_URL_MARKER = `/object/public/${AVATAR_BUCKET}/`

export async function uploadJpeg(bucket: string, path: string, blob: Blob): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(bucket)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' })
  if (error) throw error
}

// Cleaning up is best effort: a leftover file is harmless, a failed cleanup must not break the action.
export async function removeFiles(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await getSupabase().storage.from(bucket).remove(paths)
  if (error) console.warn('Could not remove files from storage:', error)
}

export function avatarPublicUrl(path: string): string {
  return getSupabase().storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
}

// Picture addresses are stored by users and shown to other people, and the API lets a user store any text there.
// Only pictures from this project's own storage are shown, so nobody can make another person's browser
// request an address of their choosing.
export function trustedAvatarUrl(url: string | null): string | null {
  if (!url || !supabaseUrl) return null
  const trustedPrefix = `${supabaseUrl.replace(/\/$/, '')}/storage/v1${PUBLIC_URL_MARKER}`
  return url.startsWith(trustedPrefix) ? url : null
}

export function avatarPathFromUrl(url: string): string | null {
  const index = url.indexOf(PUBLIC_URL_MARKER)
  return index === -1 ? null : decodeURIComponent(url.slice(index + PUBLIC_URL_MARKER.length).split('?')[0])
}

// Memory photos are private, so each one is shown through a link that expires after an hour.
export async function signPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  if (paths.length === 0) return urls
  const { data, error } = await getSupabase().storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
  if (error) throw error
  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  }
  return urls
}
