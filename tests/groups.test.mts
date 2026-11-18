import { createSuite } from './harness.ts'
import { installFakeClient } from './fakes/client.ts'
import * as groups from '../src/services/groups.ts'

const t = createSuite('Groups')

const picture = 'https://project.supabase.co/storage/v1/object/public/avatars/me/group-1.jpg'
const member = (user_id: string, role: string, status: string, name: string, invited_by: string | null = null, avatar_url: string | null = null) =>
  ({ user_id, role, status, invited_by, profiles: { id: user_id, username: name.toLowerCase(), display_name: name, avatar_url } })
const file = (type = 'image/jpeg') => ({ type }) as any
const ok1 = { data: null, error: null }

// ---------- loading ----------
{
  installFakeClient({
    respond: () => ({
      data: [
        { id: 'g1', owner_id: 'me', name: 'Inner', description: 'd', avatar_key: 'moss', avatar_url: null, group_members: [member('u2', 'member', 'invited', 'Zed', 'me'), member('u3', 'member', 'member', 'Ann'), member('me', 'owner', 'member', 'Me')] },
        { id: 'g2', owner_id: 'u9', name: 'Campus', description: '', avatar_key: null, avatar_url: picture, group_members: [member('u9', 'owner', 'member', 'Boss'), member('me', 'member', 'invited', 'Me', 'u9')] },
        { id: 'g3', owner_id: 'u9', name: 'Hidden', description: '', avatar_key: null, avatar_url: null, group_members: [member('u9', 'owner', 'member', 'Boss')] },
      ],
      error: null,
    }),
  })
  const list = await groups.fetchGroups('me')
  t.ok('load: a group I have no row in is dropped', list.map((g) => g.id).join() === 'g1,g2')
  t.ok('load: members are ordered owner, members, then invited', list[0].members.map((m) => m.displayName).join() === 'Me,Ann,Zed')
  t.ok('load: my status and the picture (preset or upload)', list[0].myStatus === 'member' && list[0].avatar === '/avatars/groups/choice-moss.svg' && list[1].myStatus === 'invited' && list[1].avatar === picture)
  t.ok('load: an invitation shows who invited me', list[1].invitedBy === 'Boss' && list[0].invitedBy === undefined)
  t.ok('load: member fields are mapped', list[0].members[1].username === 'ann' && list[0].members[1].avatarUrl === null && list[0].ownerId === 'me')
}
{
  installFakeClient({
    respond: () => ({
      data: [{ id: 'g1', owner_id: 'me', name: 'G', description: '', avatar_key: 'rose', avatar_url: 'https://evil.example/track.gif', group_members: [member('me', 'owner', 'member', 'Me', null, 'https://evil.example/me.gif'), member('u2', 'member', 'member', 'Ann', null, picture)] }],
      error: null,
    }),
  })
  const [group] = await groups.fetchGroups('me')
  t.ok('load: a group picture from another site is replaced by the preset', group.avatarUrl === null && group.avatar === '/avatars/groups/choice-rose.svg')
  t.ok('load: a member picture from another site is dropped, one from storage is kept', group.members[0].avatarUrl === null && group.members[1].avatarUrl === picture)
  installFakeClient({ respond: () => ({ data: null, error: { message: 'x' } }) })
  t.ok('load: a failure shows a friendly message', (await t.rejects(groups.fetchGroups('me')))?.message.includes('Couldn’t load your groups'))
}

// ---------- creating ----------
{
  const { calls, uploads } = installFakeClient({ rpc: (fn, a) => (fn === 'invite_to_group' && a.p_username === 'ghost' ? { data: null, error: { message: 'user_not_found' } } : { data: 'g-new', error: null }) })
  const result = await groups.createGroup('me', { name: 'N', description: 'D', avatar: { kind: 'preset', key: 'moss' } }, ['ann', ' ghost ', 'bob'])
  const created = calls.find((c) => c[1] === 'create_group')[2]
  t.ok('create: sends the name, description and preset; uploads nothing', created.p_name === 'N' && created.p_avatar_key === 'moss' && created.p_avatar_url === null && uploads.length === 0)
  t.ok('create: invites every username, trimmed', calls.filter((c) => c[1] === 'invite_to_group').map((c) => c[2].p_username).join() === 'ann,ghost,bob')
  t.ok('create: a failed invitation is reported and the group is kept', result.groupId === 'g-new' && result.inviteFailures.length === 1 && result.inviteFailures[0].username === 'ghost' && result.inviteFailures[0].message === 'No one has that username.')
}
{
  const { calls, uploads } = installFakeClient({ rpc: () => ({ data: 'g', error: null }) })
  await groups.createGroup('me', { name: 'N', description: '', avatar: { kind: 'upload', file: file() } }, [])
  const created = calls.find((c) => c[1] === 'create_group')[2]
  t.ok('create: an upload goes in the creator\'s own folder and its address is saved', /^avatars:me\/group-\d+\.jpg$/.test(uploads[0]) && /group-\d+\.jpg$/.test(created.p_avatar_url) && created.p_avatar_key === null)
}
{
  const { calls, removed } = installFakeClient({ rpc: () => ({ data: null, error: { message: 'not_allowed' } }) })
  const error = await t.rejects(groups.createGroup('me', { name: 'N', description: '', avatar: { kind: 'upload', file: file() } }, ['ann']))
  t.ok('create: a refusal removes the picture, sends no invitations and says why', error?.message === 'You don’t have permission to do that.' && removed.length === 1 && !calls.some((c) => c[1] === 'invite_to_group'))
  installFakeClient({ rpc: () => ({ data: null, error: { message: 'new row violates check constraint "groups_name_length"' } }) })
  t.ok('create: an unknown database error gets the generic message', (await t.rejects(groups.createGroup('me', { name: '', description: '', avatar: { kind: 'none' } }, [])))?.message === 'Couldn’t create the group. Please try again.')
}

// ---------- membership ----------
for (const [name, run, fn, args] of [
  ['accept', () => groups.respondToInvite('g1', true), 'respond_to_invite', { p_group_id: 'g1', p_accept: true }],
  ['decline', () => groups.respondToInvite('g1', false), 'respond_to_invite', { p_group_id: 'g1', p_accept: false }],
  ['leave', () => groups.leaveGroup('g1'), 'leave_group', { p_group_id: 'g1' }],
  ['remove a member', () => groups.removeGroupMember('g1', 'u2'), 'remove_group_member', { p_group_id: 'g1', p_user_id: 'u2' }],
  ['invite', () => groups.inviteToGroup('g1', '  ann '), 'invite_to_group', { p_group_id: 'g1', p_username: 'ann' }],
] as const) {
  const { calls } = installFakeClient({ rpc: () => ok1 })
  await run()
  t.ok(`${name}: calls ${fn} with the right arguments`, JSON.stringify(calls[0][2]) === JSON.stringify(args))
}
for (const [message, text] of [
  ['already_in_group', 'That person is already in the group or has an open invitation.'],
  ['group_full', 'This group is full.'],
  ['too_many_invites', 'You have too many open invitations. Wait for some to be answered first.'],
  ['not_allowed', 'You don’t have permission to do that.'],
] as const) {
  installFakeClient({ rpc: () => ({ data: null, error: { message } }) })
  t.ok(`errors: ${message} reads clearly`, (await t.rejects(groups.inviteToGroup('g1', 'x')))?.message === text)
}

// ---------- editing and deleting ----------
const base = { id: 'g1', ownerId: 'me', name: 'Old', description: '', avatar: picture, avatarKey: null, avatarUrl: picture, myStatus: 'member', members: [] } as any
{
  const { calls, removed } = installFakeClient()
  await groups.updateGroup(base, { name: 'New', description: 'x', avatar: { kind: 'preset', key: 'rose' } })
  const update = calls.find((c) => c[1] === 'update')[2]
  t.ok('edit: a preset sets the key, clears the upload and deletes the old file', update.avatar_key === 'rose' && update.avatar_url === null && update.name === 'New' && removed.join() === 'avatars:me/group-1.jpg')
}
{
  const { calls, uploads, removed } = installFakeClient()
  await groups.updateGroup({ ...base, avatarUrl: null, avatar: undefined, avatarKey: 'moss' }, { name: 'N', description: '', avatar: { kind: 'keep' } })
  const update = calls.find((c) => c[1] === 'update')[2]
  t.ok('edit: keep leaves the picture alone', update.avatar_key === 'moss' && update.avatar_url === null && uploads.length === 0 && removed.length === 0)
}
{
  const { calls, removed } = installFakeClient()
  await groups.updateGroup(base, { name: 'N', description: '', avatar: { kind: 'upload', file: file() } })
  const update = calls.find((c) => c[1] === 'update')[2]
  t.ok('edit: a new upload replaces the old one', /group-\d+\.jpg$/.test(update.avatar_url) && update.avatar_url !== picture && update.avatar_key === null && removed.join() === 'avatars:me/group-1.jpg')
  const none = installFakeClient()
  await groups.updateGroup(base, { name: 'N', description: '', avatar: { kind: 'none' } })
  const cleared = none.calls.find((c) => c[1] === 'update')[2]
  t.ok('edit: initials clears both columns', cleared.avatar_key === null && cleared.avatar_url === null && none.removed.length === 1)
}
{
  const { removed } = installFakeClient({ respond: () => ({ error: { message: 'not_allowed' } }) })
  const error = await t.rejects(groups.updateGroup(base, { name: 'N', description: '', avatar: { kind: 'upload', file: file() } }))
  t.ok('edit: a failed save removes the new upload and keeps the old picture', !!error && removed.length === 1 && removed[0] !== 'avatars:me/group-1.jpg')
}
{
  const { calls, removed } = installFakeClient()
  await groups.deleteGroup(base)
  t.ok('delete: removes the group by id and its picture file', calls.some((c) => c[1] === 'delete') && calls.some((c) => c[0] === 'eq' && c[1] === 'id' && c[2] === 'g1') && removed.join() === 'avatars:me/group-1.jpg')
}

t.finish()
