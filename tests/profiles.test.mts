import { createSuite } from './harness.ts'
import { installFakeClient } from './fakes/client.ts'
import * as profiles from '../src/services/profiles.ts'
import * as account from '../src/services/account.ts'

const t = createSuite('Profiles, pictures and account deletion')

const mine = 'https://project.supabase.co/storage/v1/object/public/avatars/u1/avatar-1.jpg'
const row = { id: 'u1', username: 'nadia', display_name: 'Nadia', bio: '', avatar_url: null, visibility: 'public' }
const user = (meta: any, id = '123e4567-e89b-12d3-a456-426614174000') => ({ id, user_metadata: meta }) as any
const changes = { username: 'nadia', displayName: 'Nadia', bio: 'b' }
const file = (type = 'image/jpeg') => ({ type }) as any

// ---------- loading and creating ----------
{
  const { calls } = installFakeClient({ respond: () => ({ data: row, error: null }) })
  const profile = await profiles.loadOrCreateProfile(user({ username: 'nadia' }))
  t.ok('load: an existing profile is mapped and nothing is inserted', profile.displayName === 'Nadia' && profile.visibility === 'public' && profile.avatarUrl === null && !calls.some((c) => c[1] === 'insert'))
}
{
  let fetches = 0
  const { calls } = installFakeClient({ respond: (_t, op) => (op === 'insert' ? { error: null } : ++fetches === 1 ? { data: null, error: null } : { data: row, error: null }) })
  await profiles.loadOrCreateProfile(user({ username: 'Nadia.W!!' }))
  t.ok('create: a missing profile is created from the signup username, cleaned up', calls.find((c) => c[1] === 'insert')[2].username === 'Nadia.W')
}
{
  let fetches = 0
  const { calls } = installFakeClient({ respond: (_t, op) => (op === 'insert' ? { error: null } : ++fetches === 1 ? { data: null, error: null } : { data: row, error: null }) })
  await profiles.loadOrCreateProfile(user({}))
  t.ok('create: with no username a generated one is used', /^user123e4567$/.test(calls.find((c) => c[1] === 'insert')[2].username))
}
{
  let fetches = 0
  let inserts = 0
  const { calls } = installFakeClient({ respond: (_t, op) => (op === 'insert' ? (++inserts === 1 ? { error: { code: '23505', message: 'dup' } } : { error: null }) : ++fetches === 1 ? { data: null, error: null } : { data: row, error: null }) })
  await profiles.loadOrCreateProfile(user({ username: 'nadia' }))
  const names = calls.filter((c) => c[1] === 'insert').map((c) => c[2].username)
  t.ok('create: a username clash is retried once with a number (within 20 characters)', names.length === 2 && /^nadia_\d{4}$/.test(names[1]) && names[1].length <= 20)
}
{
  installFakeClient({ respond: (_t, op) => (op === 'insert' ? { error: { code: '23505', message: 'dup' } } : { data: null, error: null }) })
  t.ok('create: still nothing after the retry shows a clear error', !!(await t.rejects(profiles.loadOrCreateProfile(user({ username: 'nadia' })))))
}
{
  installFakeClient({ respond: () => ({ data: { ...row, avatar_url: 'https://evil.example/pixel.gif' }, error: null }) })
  const profile = await profiles.fetchProfile('u1')
  t.ok('load: a picture address on another site is dropped', profile?.avatarUrl === null)
  installFakeClient({ respond: () => ({ data: { ...row, avatar_url: mine }, error: null }) })
  t.ok('load: a picture from this project\'s storage is kept', (await profiles.fetchProfile('u1'))?.avatarUrl === mine)
}

// ---------- editing ----------
{
  installFakeClient({ respond: () => ({ data: null, error: { code: '23505', message: 'dup' } }) })
  t.ok('edit: a taken username -> username-taken', (await t.rejects(profiles.updateProfile('u1', changes)))?.code === 'username-taken')
  const { calls } = installFakeClient({ respond: () => ({ data: row, error: null }) })
  await profiles.updateProfile('u1', changes)
  t.ok('edit: text only sends the three text columns and touches no files', JSON.stringify(Object.keys(calls.find((c) => c[1] === 'update')[2])) === '["username","display_name","bio"]')
}
{
  const { calls, uploads, removed } = installFakeClient({ respond: () => ({ data: row, error: null }) })
  await profiles.updateProfile('u1', changes, { kind: 'upload', file: file() }, mine)
  const payload = calls.find((c) => c[1] === 'update')[2]
  t.ok('picture: the file goes to avatars/<user>/avatar-<time>.jpg', /^avatars:u1\/avatar-\d+\.jpg$/.test(uploads[0]))
  t.ok('picture: the row gets the public address together with the text', /\/object\/public\/avatars\/u1\/avatar-\d+\.jpg$/.test(payload.avatar_url) && payload.display_name === 'Nadia')
  t.ok('picture: the previous file is deleted afterwards', removed.join() === 'avatars:u1/avatar-1.jpg')
}
{
  const { removed } = installFakeClient({ respond: () => ({ data: null, error: { code: '23505', message: 'dup' } }) })
  const error = await t.rejects(profiles.updateProfile('u1', changes, { kind: 'upload', file: file() }, null))
  t.ok('picture: if saving fails the new file is cleaned up', error?.code === 'username-taken' && removed.length === 1 && removed[0].startsWith('avatars:u1/avatar-'))
}
{
  const { calls, removed, uploads } = installFakeClient({ respond: () => ({ data: row, error: null }) })
  await profiles.updateProfile('u1', changes, { kind: 'remove' }, mine)
  t.ok('picture: removing clears the address and deletes the file', calls.find((c) => c[1] === 'update')[2].avatar_url === null && removed.join() === 'avatars:u1/avatar-1.jpg' && uploads.length === 0)
  installFakeClient({ respond: () => ({ data: row, error: null }) })
  t.ok('picture: a non-image shows the image message, not a generic one', (await t.rejects(profiles.updateProfile('u1', changes, { kind: 'upload', file: file('text/plain') })))?.message === 'Choose a JPEG, PNG or WebP image.')
}

// ---------- privacy setting and usernames ----------
{
  const { calls } = installFakeClient({ respond: () => ({ error: null }) })
  await profiles.updateProfileVisibility('u1', 'connections')
  t.ok('visibility: only the visibility column of my row is updated', JSON.stringify(calls.find((c) => c[1] === 'update')[2]) === JSON.stringify({ visibility: 'connections' }))
  installFakeClient({ respond: () => ({ error: { message: 'x' } }) })
  t.ok('visibility: a failure becomes a profile error', (await t.rejects(profiles.updateProfileVisibility('u1', 'private')))?.code === 'unknown')
}
{
  installFakeClient({ rpc: () => ({ data: true, error: null }) })
  t.ok('username check: free', (await profiles.isUsernameAvailable('nadia')) === true)
  installFakeClient({ rpc: () => ({ data: false, error: null }) })
  t.ok('username check: taken', (await profiles.isUsernameAvailable('nadia')) === false)
}

// ---------- deleting the account ----------
{
  const { calls, removed } = installFakeClient({
    list: {
      'memory-photos:u1': [{ name: 'mem1', id: null }, { name: 'mem2', id: null }],
      'memory-photos:u1/mem1': [{ name: 'a.jpg', id: 'x' }, { name: 'b.jpg', id: 'y' }],
      'memory-photos:u1/mem2': [{ name: 'c.jpg', id: 'z' }],
      'avatars:u1': [{ name: 'avatar-1.jpg', id: 'q' }, { name: 'group-2.jpg', id: 'r' }],
    },
  })
  await account.deleteAccount('u1')
  t.ok('delete account: calls the database function that removes the account', calls.some((c) => c[0] === 'rpc' && c[1] === 'delete_my_account'))
  t.ok('delete account: every photo and picture file is removed, nested folders included', removed.sort().join() === ['avatars:u1/avatar-1.jpg', 'avatars:u1/group-2.jpg', 'memory-photos:u1/mem1/a.jpg', 'memory-photos:u1/mem1/b.jpg', 'memory-photos:u1/mem2/c.jpg'].sort().join())
}
{
  const { removed } = installFakeClient({
    list: { 'memory-photos:u1': [{ name: 'a.jpg', id: 'x' }] },
    rpc: () => ({ data: null, error: { message: 'boom' } }),
  })
  const error = await t.rejects(account.deleteAccount('u1'))
  t.ok('delete account: if the deletion fails no file is touched', !!error && removed.length === 0 && error.message.includes('Couldn’t delete your account'))
}

t.finish()
