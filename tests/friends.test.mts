import { createSuite } from './harness.ts'
import { installFakeClient } from './fakes/client.ts'
import * as friends from '../src/services/friends.ts'

const t = createSuite('Connections')

const picture = 'https://project.supabase.co/storage/v1/object/public/avatars/u1/a.jpg'
const profile = (id: string, name: string, bio = '', avatar_url: string | null = null) => ({ id, username: name.toLowerCase(), display_name: name, bio, avatar_url })

// ---------- loading ----------
{
  const { calls } = installFakeClient({
    respond: () => ({
      data: [
        { requester_id: 'me', addressee_id: 'u1', status: 'accepted', requester: profile('me', 'Me'), addressee: profile('u1', 'Zed', '', picture) },
        { requester_id: 'u2', addressee_id: 'me', status: 'accepted', requester: profile('u2', 'Ann', 'hi', 'https://evil.example/p.gif'), addressee: profile('me', 'Me') },
        { requester_id: 'me', addressee_id: 'u3', status: 'pending', requester: profile('me', 'Me'), addressee: profile('u3', 'Bob') },
        { requester_id: 'u4', addressee_id: 'me', status: 'pending', requester: profile('u4', 'Cy'), addressee: profile('me', 'Me') },
        { requester_id: 'u5', addressee_id: 'me', status: 'pending', requester: null, addressee: profile('me', 'Me') },
      ],
      error: null,
    }),
  })
  const list = await friends.fetchFriends('me')
  const status = Object.fromEntries(list.map((p) => [p.id, p.status]))
  t.ok('load: shows the other person whichever side asked', list.map((p) => p.id).sort().join() === 'u1,u2,u3,u4')
  t.ok('load: connected both ways, requested = I asked, incoming = they asked', status.u1 === 'connected' && status.u2 === 'connected' && status.u3 === 'requested' && status.u4 === 'incoming')
  t.ok('load: sorted by name, a hidden profile is skipped', list.map((p) => p.displayName).join() === 'Ann,Bob,Cy,Zed' && !list.some((p) => p.id === 'u5'))
  t.ok('load: a picture from storage is kept, one from another site is dropped', list.find((p) => p.id === 'u1')?.avatarUrl === picture && list.find((p) => p.id === 'u2')?.avatarUrl === null)
  t.ok('load: both profiles are read through their own foreign keys', calls[0][2].includes('requester:profiles!requester_id(') && calls[0][2].includes('addressee:profiles!addressee_id('))
  installFakeClient({ respond: () => ({ data: null, error: { message: 'x' } }) })
  t.ok('load: a failure shows a friendly message', (await t.rejects(friends.fetchFriends('me')))?.message.includes('Couldn’t load your connections'))
}

// ---------- search ----------
{
  const { calls } = installFakeClient({
    rpc: () => ({ data: [{ ...profile('u1', 'Kenji'), relationship: 'none' }, { ...profile('u2', 'Ken'), relationship: 'incoming' }, { ...profile('u3', 'Kendra'), relationship: 'connected' }, { ...profile('u4', 'Kent'), relationship: 'requested' }], error: null }),
  })
  const found = await friends.searchPeople('ken')
  t.ok('search: sends the query and maps each relationship to a status', calls[0][1] === 'search_profiles' && calls[0][2].p_query === 'ken' && found.map((p) => p.status).join() === 'none,incoming,connected,requested')
  installFakeClient({ rpc: () => ({ data: null, error: { message: 'x' } }) })
  t.ok('search: a failure shows a friendly message', (await t.rejects(friends.searchPeople('ken')))?.message.includes('Search didn’t go through'))
}

// ---------- requests ----------
{
  const { calls } = installFakeClient({ rpc: () => ({ data: 'requested', error: null }) })
  t.ok('send: a new request', (await friends.sendFriendRequest('u1')) === 'requested' && calls[0][2].p_user_id === 'u1')
  installFakeClient({ rpc: () => ({ data: 'connected', error: null }) })
  t.ok('send: connects at once when they had already asked', (await friends.sendFriendRequest('u1')) === 'connected')
}
for (const [message, text] of [
  ['already_friends', 'You’re already connected.'],
  ['already_requested', 'You already sent that person a request.'],
  ['too_many_requests', 'You have too many open requests. Wait for some to be answered first.'],
  ['user_not_found', 'That person could not be found.'],
  ['not_allowed', 'You don’t have permission to do that.'],
] as const) {
  installFakeClient({ rpc: () => ({ data: null, error: { message } }) })
  t.ok(`errors: ${message} reads clearly`, (await t.rejects(friends.sendFriendRequest('u1')))?.message === text)
}
installFakeClient({ rpc: () => ({ data: null, error: { message: 'weird database failure' } }) })
t.ok('errors: anything unknown gets the generic message', (await t.rejects(friends.sendFriendRequest('u1')))?.message === 'Couldn’t send the request. Please try again.')

for (const [name, run, fn, args] of [
  ['accept', () => friends.respondToFriendRequest('u1', true), 'respond_to_friend_request', { p_requester_id: 'u1', p_accept: true }],
  ['decline', () => friends.respondToFriendRequest('u1', false), 'respond_to_friend_request', { p_requester_id: 'u1', p_accept: false }],
  ['cancel', () => friends.cancelFriendRequest('u2'), 'cancel_friend_request', { p_addressee_id: 'u2' }],
  ['remove', () => friends.removeFriend('u3'), 'remove_friend', { p_user_id: 'u3' }],
] as const) {
  const { calls } = installFakeClient()
  await run()
  t.ok(`${name}: calls ${fn} with the right arguments`, calls[0][1] === fn && JSON.stringify(calls[0][2]) === JSON.stringify(args))
}

t.finish()
