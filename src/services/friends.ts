import type { ConnectionStatus, Person } from '../types'
import { getSupabase } from '../lib/supabase'
import { databaseError, fail } from './serviceError'
import { trustedAvatarUrl } from './storage'

const PROFILE = 'id, username, display_name, bio, avatar_url'

interface ProfileRow {
  id: string
  username: string
  display_name: string
  bio: string
  avatar_url: string | null
}

interface FriendshipRow {
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  requester: ProfileRow | null
  addressee: ProfileRow | null
}

interface SearchRow extends ProfileRow {
  relationship: ConnectionStatus
}

const FRIEND_MESSAGES: Record<string, string> = {
  user_not_found: 'That person could not be found.',
  already_friends: 'You’re already connected.',
  already_requested: 'You already sent that person a request.',
  too_many_requests: 'You have too many open requests. Wait for some to be answered first.',
}

const friendError = (error: { message: string }, fallback: string) => databaseError(error, fallback, FRIEND_MESSAGES)

const toPerson = (row: ProfileRow, status: ConnectionStatus): Person => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  bio: row.bio,
  avatarUrl: trustedAvatarUrl(row.avatar_url),
  status,
})

// Everyone you are connected with or have an open request with, in either direction.
export async function fetchFriends(userId: string): Promise<Person[]> {
  const { data, error } = await getSupabase()
    .from('friendships')
    .select(
      `requester_id, addressee_id, status, requester:profiles!requester_id(${PROFILE}), addressee:profiles!addressee_id(${PROFILE})`,
    )
  if (error) throw fail(error, 'Couldn’t load your connections. Check your connection and try again.')

  const people: Person[] = []
  for (const row of data as unknown as FriendshipRow[]) {
    const iAsked = row.requester_id === userId
    const other = iAsked ? row.addressee : row.requester
    if (!other) continue
    people.push(toPerson(other, row.status === 'accepted' ? 'connected' : iAsked ? 'requested' : 'incoming'))
  }
  return people.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function searchPeople(query: string): Promise<Person[]> {
  const { data, error } = await getSupabase().rpc('search_profiles', { p_query: query })
  if (error) throw fail(error, 'Search didn’t go through. Check your connection and try again.')
  return (data as SearchRow[]).map((row) => toPerson(row, row.relationship))
}

// Resolves to 'connected' when the other person had already asked you.
export async function sendFriendRequest(userId: string): Promise<'requested' | 'connected'> {
  const { data, error } = await getSupabase().rpc('send_friend_request', { p_user_id: userId })
  if (error) throw friendError(error, 'Couldn’t send the request. Please try again.')
  return data === 'connected' ? 'connected' : 'requested'
}

export async function respondToFriendRequest(requesterId: string, accept: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('respond_to_friend_request', { p_requester_id: requesterId, p_accept: accept })
  if (error) throw friendError(error, 'Couldn’t answer the request. Please try again.')
}

export async function cancelFriendRequest(addresseeId: string): Promise<void> {
  const { error } = await getSupabase().rpc('cancel_friend_request', { p_addressee_id: addresseeId })
  if (error) throw friendError(error, 'Couldn’t cancel the request. Please try again.')
}

export async function removeFriend(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('remove_friend', { p_user_id: userId })
  if (error) throw friendError(error, 'Couldn’t remove that connection. Please try again.')
}
