import type { Group, GroupAvatarChoice, GroupAvatarKey, GroupMember } from '../types'
import { getSupabase } from '../lib/supabase'
import { AVATAR_MAX_EDGE, ImageError, prepareImage } from '../lib/imageProcessing'
import { presetSrc } from '../lib/groupAvatars'
import { databaseError as toDatabaseError, fail, ServiceError } from './serviceError'
import { AVATAR_BUCKET, avatarPathFromUrl, avatarPublicUrl, removeFiles, trustedAvatarUrl, uploadJpeg } from './storage'

const COLUMNS =
  'id, owner_id, name, description, avatar_key, avatar_url, ' +
  'group_members(user_id, role, status, invited_by, profiles!user_id(id, username, display_name, avatar_url))'

interface MemberRow {
  user_id: string
  role: 'owner' | 'member'
  status: 'member' | 'invited'
  invited_by: string | null
  profiles: { id: string; username: string; display_name: string; avatar_url: string | null } | null
}

interface GroupRow {
  id: string
  owner_id: string
  name: string
  description: string
  avatar_key: GroupAvatarKey | null
  avatar_url: string | null
  group_members: MemberRow[]
}

const GROUP_MESSAGES: Record<string, string> = {
  user_not_found: 'No one has that username.',
  already_in_group: 'That person is already in the group or has an open invitation.',
  group_full: 'This group is full.',
  too_many_invites: 'You have too many open invitations. Wait for some to be answered first.',
}

const groupError = (error: { message: string }, fallback: string) =>
  toDatabaseError(error, fallback, GROUP_MESSAGES)

const memberOrder = (member: GroupMember) => (member.role === 'owner' ? 0 : member.status === 'member' ? 1 : 2)

function toGroup(row: GroupRow, myId: string): Group | null {
  const members: GroupMember[] = row.group_members
    .filter((m): m is MemberRow & { profiles: NonNullable<MemberRow['profiles']> } => m.profiles !== null)
    .map((m) => ({
      userId: m.user_id,
      username: m.profiles.username,
      displayName: m.profiles.display_name,
      avatarUrl: trustedAvatarUrl(m.profiles.avatar_url),
      role: m.role,
      status: m.status,
    }))
    .sort((a, b) => memberOrder(a) - memberOrder(b) || a.displayName.localeCompare(b.displayName))

  const mine = row.group_members.find((m) => m.user_id === myId)
  if (!mine) return null
  const pictureUrl = trustedAvatarUrl(row.avatar_url)

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    avatar: pictureUrl ?? presetSrc(row.avatar_key),
    avatarKey: row.avatar_key,
    avatarUrl: pictureUrl,
    ownerId: row.owner_id,
    myStatus: mine.status,
    invitedBy: mine.status === 'invited' ? members.find((m) => m.userId === mine.invited_by)?.displayName : undefined,
    members,
  }
}

export async function fetchGroups(userId: string): Promise<Group[]> {
  const { data, error } = await getSupabase().from('groups').select(COLUMNS).order('created_at', { ascending: true })
  if (error) throw fail(error, 'Couldn’t load your groups. Check your connection and try again.')
  return (data as unknown as GroupRow[]).map((row) => toGroup(row, userId)).filter((g): g is Group => g !== null)
}

async function uploadGroupPicture(userId: string, file: File): Promise<string> {
  try {
    const blob = await prepareImage(file, AVATAR_MAX_EDGE)
    const path = `${userId}/group-${Date.now()}.jpg`
    await uploadJpeg(AVATAR_BUCKET, path, blob)
    return avatarPublicUrl(path)
  } catch (error) {
    if (error instanceof ImageError) throw new ServiceError(error.message)
    throw fail(error, 'Your picture couldn’t be uploaded. Please try again.')
  }
}

async function removeUploaded(url: string | null): Promise<void> {
  const path = url ? avatarPathFromUrl(url) : null
  if (path) await removeFiles(AVATAR_BUCKET, [path])
}

export interface GroupDetails {
  name: string
  description: string
  avatar: GroupAvatarChoice
}

export interface InviteFailure {
  username: string
  message: string
}

// Creates the group, then invites each username. A bad username does not undo the group.
export async function createGroup(
  userId: string,
  details: GroupDetails,
  usernames: string[],
): Promise<{ groupId: string; inviteFailures: InviteFailure[] }> {
  const { avatar } = details
  const avatarUrl = avatar.kind === 'upload' ? await uploadGroupPicture(userId, avatar.file) : null

  const { data, error } = await getSupabase().rpc('create_group', {
    p_name: details.name,
    p_description: details.description,
    p_avatar_key: avatar.kind === 'preset' ? avatar.key : null,
    p_avatar_url: avatarUrl,
  })
  if (error) {
    await removeUploaded(avatarUrl)
    throw groupError(error, 'Couldn’t create the group. Please try again.')
  }
  const groupId = data as string

  const inviteFailures: InviteFailure[] = []
  for (const raw of usernames) {
    const username = raw.trim()
    try {
      await inviteToGroup(groupId, username)
    } catch (err) {
      inviteFailures.push({ username, message: err instanceof ServiceError ? err.message : 'The invitation failed.' })
    }
  }
  return { groupId, inviteFailures }
}

export async function inviteToGroup(groupId: string, username: string): Promise<void> {
  const { error } = await getSupabase().rpc('invite_to_group', { p_group_id: groupId, p_username: username.trim() })
  if (error) throw groupError(error, 'Couldn’t send the invitation. Please try again.')
}

export async function respondToInvite(groupId: string, accept: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('respond_to_invite', { p_group_id: groupId, p_accept: accept })
  if (error) throw groupError(error, 'Couldn’t answer the invitation. Please try again.')
}

export async function leaveGroup(groupId: string): Promise<void> {
  const { error } = await getSupabase().rpc('leave_group', { p_group_id: groupId })
  if (error) throw groupError(error, 'Couldn’t leave the group. Please try again.')
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('remove_group_member', { p_group_id: groupId, p_user_id: userId })
  if (error) throw groupError(error, 'Couldn’t remove that person. Please try again.')
}

export async function updateGroup(group: Group, details: GroupDetails): Promise<void> {
  const { avatar } = details
  let avatarKey = group.avatarKey
  let avatarUrl = group.avatarUrl
  let uploadedUrl: string | null = null

  if (avatar.kind === 'upload') {
    uploadedUrl = await uploadGroupPicture(group.ownerId, avatar.file)
    avatarKey = null
    avatarUrl = uploadedUrl
  } else if (avatar.kind === 'preset') {
    avatarKey = avatar.key
    avatarUrl = null
  } else if (avatar.kind === 'none') {
    avatarKey = null
    avatarUrl = null
  }

  const { error } = await getSupabase()
    .from('groups')
    .update({ name: details.name, description: details.description, avatar_key: avatarKey, avatar_url: avatarUrl })
    .eq('id', group.id)
  if (error) {
    await removeUploaded(uploadedUrl)
    throw groupError(error, 'Couldn’t save the group. Please try again.')
  }

  if (group.avatarUrl !== avatarUrl) await removeUploaded(group.avatarUrl)
}

export async function deleteGroup(group: Group): Promise<void> {
  const { error } = await getSupabase().from('groups').delete().eq('id', group.id)
  if (error) throw groupError(error, 'Couldn’t delete the group. Please try again.')

  await removeUploaded(group.avatarUrl)
}
