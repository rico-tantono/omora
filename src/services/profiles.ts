import type { User } from '@supabase/supabase-js'
import type { AvatarChange, Profile, ProfileChanges, Visibility } from '../types'
import { getSupabase } from '../lib/supabase'
import { AVATAR_MAX_EDGE, ImageError, prepareImage } from '../lib/imageProcessing'
import { AVATAR_BUCKET, avatarPathFromUrl, avatarPublicUrl, removeFiles, trustedAvatarUrl, uploadJpeg } from './storage'

const COLUMNS = 'id, username, display_name, bio, avatar_url, visibility'
const UNIQUE_VIOLATION = '23505'

interface ProfileRow {
  id: string
  username: string
  display_name: string
  bio: string
  avatar_url: string | null
  visibility: Visibility
}

export type ProfileErrorCode = 'username-taken' | 'unknown'

export class ProfileError extends Error {
  code: ProfileErrorCode
  constructor(code: ProfileErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  bio: row.bio,
  avatarUrl: trustedAvatarUrl(row.avatar_url),
  visibility: row.visibility,
})

function toProfileError(error: { code?: string; message: string }): ProfileError {
  if (error.code === UNIQUE_VIOLATION) {
    return new ProfileError('username-taken', 'That username is taken. Try another one.')
  }
  console.error('Profile request failed:', error)
  return new ProfileError('unknown', 'Something went wrong with your profile. Please try again.')
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase().from('profiles').select(COLUMNS).eq('id', userId).maybeSingle()
  if (error) throw toProfileError(error)
  return data ? toProfile(data as ProfileRow) : null
}

// The picture is uploaded first and the row updated once, so a failed save never points at a missing file.
export async function updateProfile(
  userId: string,
  changes: ProfileChanges,
  avatar?: AvatarChange,
  currentAvatarUrl?: string | null,
): Promise<Profile> {
  let newAvatarUrl: string | null | undefined // undefined = leave the picture alone
  let uploadedPath: string | null = null

  if (avatar?.kind === 'upload') {
    try {
      const blob = await prepareImage(avatar.file, AVATAR_MAX_EDGE)
      uploadedPath = `${userId}/avatar-${Date.now()}.jpg`
      await uploadJpeg(AVATAR_BUCKET, uploadedPath, blob)
      newAvatarUrl = avatarPublicUrl(uploadedPath)
    } catch (error) {
      if (error instanceof ImageError) throw new ProfileError('unknown', error.message)
      console.error('Avatar upload failed:', error)
      throw new ProfileError('unknown', 'Your picture couldn’t be uploaded. Please try again.')
    }
  } else if (avatar?.kind === 'remove') {
    newAvatarUrl = null
  }

  const { data, error } = await getSupabase()
    .from('profiles')
    .update({
      username: changes.username,
      display_name: changes.displayName,
      bio: changes.bio,
      ...(newAvatarUrl !== undefined && { avatar_url: newAvatarUrl }),
    })
    .eq('id', userId)
    .select(COLUMNS)
    .single()
  if (error) {
    if (uploadedPath) await removeFiles(AVATAR_BUCKET, [uploadedPath])
    throw toProfileError(error)
  }

  if (newAvatarUrl !== undefined && currentAvatarUrl) {
    const oldPath = avatarPathFromUrl(currentAvatarUrl)
    if (oldPath && oldPath !== uploadedPath) await removeFiles(AVATAR_BUCKET, [oldPath])
  }
  return toProfile(data as ProfileRow)
}

export async function updateProfileVisibility(userId: string, visibility: Visibility): Promise<void> {
  const { error } = await getSupabase().from('profiles').update({ visibility }).eq('id', userId)
  if (error) throw toProfileError(error)
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_username_available', { p_username: username })
  if (error) throw error
  return data === true
}

// A database trigger normally creates the profile at signup. This covers accounts the trigger
// missed, using the same username rules, so a sign-in never ends without a profile.
export async function loadOrCreateProfile(user: User): Promise<Profile> {
  const existing = await fetchProfile(user.id)
  if (existing) return existing

  const preferred = preferredUsername(user)
  for (const username of [preferred, `${preferred.slice(0, 15)}_${Math.floor(1000 + Math.random() * 9000)}`]) {
    const { error } = await getSupabase().from('profiles').insert({ id: user.id, username, display_name: username })
    if (!error) break
    if (error.code !== UNIQUE_VIOLATION) throw toProfileError(error)
  }

  // Also reached when a parallel request created the row first (primary key conflict).
  const created = await fetchProfile(user.id)
  if (!created) throw new ProfileError('unknown', 'Your profile could not be created. Please try again.')
  return created
}

function preferredUsername(user: User): string {
  const raw: unknown = user.user_metadata?.username
  const cleaned = typeof raw === 'string' ? raw.replace(/[^A-Za-z0-9._]/g, '').slice(0, 20) : ''
  return cleaned.length >= 3 ? cleaned : `user${user.id.replace(/-/g, '').slice(0, 8)}`
}
