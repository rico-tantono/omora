import { createSuite } from './harness.ts'
import { installFakeClient } from './fakes/client.ts'
import * as memories from '../src/services/memories.ts'
import * as collections from '../src/services/collections.ts'
import * as storage from '../src/services/storage.ts'

const t = createSuite('Memories, sharing, collections and storage')

const row = (id: string, owner_id: string, group_id: string | null, extra: any = {}) => ({
  id, owner_id, group_id, title: 'T', story: '', place_name: 'P', area: '', lat: 1, lng: 2,
  visit_date: '2026-01-01', tags: [], visibility: 'private', memory_photos: [], ...extra,
})
const input = { title: 'Rain', placeName: 'Park', area: 'Bandung', lat: -6.9, lng: 107.6, story: 's', visitDate: '2026-10-01', tags: ['a'], visibility: 'private' as const }
const jpeg = (type = 'image/jpeg') => ({ type }) as any

// ---------- loading ----------
{
  const { store } = installFakeClient({
    respond: () => ({
      data: [
        row('m1', 'u', null, { memory_photos: [{ id: 'p2', storage_path: 'u/m1/b.jpg', caption: null, position: 1 }, { id: 'p1', storage_path: 'u/m1/a.jpg', caption: 'hi', position: 0 }] }),
        row('m2', 'u', null, { title: 'B', story: 'x', visibility: 'connections' }),
      ],
      error: null,
    }),
  })
  const list = await memories.fetchMemories('u')
  t.ok('load: fields are mapped to the app\'s names', list[0].placeName === 'P' && list[0].visitDate === '2026-01-01' && list[0].authorId === 'u')
  t.ok('load: photos are sorted, with caption, signed link and storage path', list[0].photos.map((p: any) => p.id).join() === 'p1,p2' && list[0].photos[0].url === 'signed://u/m1/a.jpg' && list[0].photos[0].caption === 'hi' && list[0].photos[0].path === 'u/m1/a.jpg')
  t.ok('load: all photo links are signed in one call', store.signedBatches === 1)
}
{
  const { store } = installFakeClient({ respond: () => ({ data: [], error: null }) })
  await memories.fetchMemories('u')
  t.ok('load: no photos means no signing call', store.signedBatches === 0)
  installFakeClient({ respond: () => ({ data: null, error: { message: 'x' } }) })
  t.ok('load: a failure shows a friendly message', (await t.rejects(memories.fetchMemories('u')))?.message.includes('Couldn’t load your memories'))
}

// ---------- whose memory is it ----------
{
  installFakeClient({
    respond: () => ({
      data: [row('a', 'u', null), row('b', 'u', 'g1'), row('c', 'f2', 'g1'), row('d', 'f1', null, { visibility: 'connections' })],
      error: null,
    }),
  })
  const by = Object.fromEntries((await memories.fetchMemories('u')).map((m: any) => [m.id, m]))
  t.ok('mine: my own memory', by.a.owner.kind === 'me' && by.a.addedBy === undefined)
  t.ok('mine in a group: a group memory I added', by.b.owner.kind === 'group' && by.b.owner.groupId === 'g1' && by.b.addedBy === 'me')
  t.ok('theirs in a group: a group memory they added', by.c.owner.groupId === 'g1' && by.c.addedBy === 'f2' && by.c.authorId === 'f2')
  t.ok('a connection\'s memory: shared by that person', by.d.owner.kind === 'person' && by.d.owner.personId === 'f1')
}

// ---------- creating ----------
{
  const { calls, uploads, store } = installFakeClient({
    respond: (table) => (table === 'memories' ? { data: { id: 'mem1' }, error: null } : { data: [{ id: 'ph1', storage_path: 'x', caption: null, position: 0 }, { id: 'ph2', storage_path: 'y', caption: null, position: 1 }], error: null }),
  })
  const memory = await memories.createMemory('user1', input, [jpeg(), jpeg()])
  const inserted = calls.find((c) => c[0] === 'memories' && c[1] === 'insert')[2]
  t.ok('create: saves the memory with its owner and place', inserted.owner_id === 'user1' && inserted.place_name === 'Park' && inserted.visit_date === '2026-10-01' && inserted.group_id === null)
  t.ok('create: photos go to <user>/<memory>/<id>.jpg in the private bucket', uploads.length === 2 && uploads.every((u) => /^memory-photos:user1\/mem1\/[0-9a-f-]{36}\.jpg$/.test(u)))
  t.ok('create: photo rows keep their order', (() => { const rows = calls.find((c) => c[0] === 'memory_photos' && c[1] === 'insert')[2]; return rows.length === 2 && rows[0].position === 0 && rows[1].position === 1 && rows[0].memory_id === 'mem1' })())
  t.ok('create: returns the new memory with signed photo links', memory.id === 'mem1' && memory.owner.kind === 'me' && memory.photos.length === 2)
  t.ok('create: uploads never overwrite and are cached for a year', store.uploadOptions.upsert === false && store.uploadOptions.contentType === 'image/jpeg')
}
{
  const { calls, uploads, removed } = installFakeClient({ respond: () => ({ data: { id: 'mem1' }, error: null }), failUploadAt: 1 })
  const error = await t.rejects(memories.createMemory('user1', input, [jpeg(), jpeg()]))
  t.ok('create: a failed upload rolls everything back', !!error && calls.some((c) => c[0] === 'memories' && c[1] === 'delete') && removed.length === 1 && removed[0] === uploads[0])
  t.ok('create: the message says nothing was saved', error?.message.includes('wasn’t saved'))
}
{
  const { uploads } = installFakeClient({ respond: () => ({ data: null, error: { message: 'rls' } }) })
  t.ok('create: a refused insert uploads nothing', !!(await t.rejects(memories.createMemory('user1', input, [jpeg()]))) && uploads.length === 0)
}
{
  const { uploads, calls } = installFakeClient({ respond: () => ({ data: { id: 'mem1' }, error: null }) })
  await memories.createMemory('user1', input, [])
  t.ok('create: no photos means no storage or photo rows', uploads.length === 0 && !calls.some((c) => c[0] === 'memory_photos'))
  const error = await t.rejects(memories.createMemory('user1', input, [jpeg('text/plain')]))
  t.ok('create: a non-image is refused before anything is saved', error?.message === 'Choose a JPEG, PNG or WebP image.')
}
{
  const { calls } = installFakeClient({ respond: (table) => (table === 'memories' ? { data: { id: 'g-mem' }, error: null } : { data: [], error: null }) })
  const memory = await memories.createMemory('user1', { ...input, visibility: 'connections' }, [], 'g1')
  const inserted = calls.find((c) => c[0] === 'memories' && c[1] === 'insert')[2]
  t.ok('create in a group: stores the group and keeps "private" as the base visibility', inserted.group_id === 'g1' && inserted.visibility === 'private')
  t.ok('create in a group: comes back as a group memory added by me', memory.owner.kind === 'group' && memory.addedBy === 'me' && memory.authorId === 'user1')
  const personal = installFakeClient({ respond: () => ({ data: { id: 'p-mem' }, error: null } as any) })
  await memories.createMemory('user1', { ...input, visibility: 'connections' }, [])
  const row2 = personal.calls.find((c) => c[0] === 'memories' && c[1] === 'insert')[2]
  t.ok('create personal: no group and the chosen visibility', row2.group_id === null && row2.visibility === 'connections')
}

// ---------- changing and deleting ----------
{
  const { calls } = installFakeClient()
  await memories.updateMemorySharing('m1', { groupId: 'g1', visibility: 'connections' })
  t.ok('sharing: moving to a group forces private', JSON.stringify(calls.find((c) => c[1] === 'update')[2]) === JSON.stringify({ group_id: 'g1', visibility: 'private' }))
  const next = installFakeClient()
  await memories.updateMemorySharing('m1', { groupId: null, visibility: 'connections' })
  t.ok('sharing: moving to connections clears the group', JSON.stringify(next.calls.find((c) => c[1] === 'update')[2]) === JSON.stringify({ group_id: null, visibility: 'connections' }))
  installFakeClient({ respond: () => ({ error: { message: 'rls' } }) })
  t.ok('sharing: a refusal shows a friendly message', (await t.rejects(memories.updateMemorySharing('m1', { groupId: null, visibility: 'private' })))?.message.includes('Couldn’t change who can see'))
}
{
  const { calls, removed } = installFakeClient()
  await memories.deleteMemory('m1', ['u/m1/a.jpg', 'u/m1/b.jpg'])
  t.ok('delete: removes the memory by id', calls.some((c) => c[1] === 'delete') && calls.some((c) => c[0] === 'eq' && c[1] === 'id' && c[2] === 'm1'))
  t.ok('delete: removes its photo files afterwards', removed.join() === 'memory-photos:u/m1/a.jpg,memory-photos:u/m1/b.jpg')
  const failed = installFakeClient({ respond: () => ({ error: { message: 'rls' } }) })
  const error = await t.rejects(memories.deleteMemory('m1', ['u/m1/a.jpg']))
  t.ok('delete: if the memory cannot be deleted its photos are kept', !!error && failed.removed.length === 0)
}

// ---------- collections ----------
{
  installFakeClient({ respond: () => ({ data: [{ id: 'c1', name: 'Quiet', collection_memories: [{ memory_id: 'a' }, { memory_id: 'b' }] }], error: null }) })
  const first = await collections.fetchCollections('u')
  const second = await collections.fetchCollections('u')
  t.ok('collections: members are loaded', first[0].memoryIds.join() === 'a,b' && first[0].name === 'Quiet')
  t.ok('collections: the color pair is stable per collection', first[0].from === second[0].from && first[0].to === second[0].to)
}
{
  const { calls } = installFakeClient({ respond: (table) => (table === 'collections' ? { data: { id: 'c9', name: 'N' }, error: null } : { data: null, error: null }) })
  const made = await collections.createCollection('u', 'N', ['m1', 'm2'])
  const links = calls.find((c) => c[0] === 'collection_memories' && c[1] === 'insert')[2]
  t.ok('collections: create saves the collection, then its memories', made.id === 'c9' && made.memoryIds.join() === 'm1,m2' && links.length === 2 && links[0].collection_id === 'c9')
}
{
  const { calls } = installFakeClient({ respond: (table) => (table === 'collections' ? { data: { id: 'c9', name: 'N' }, error: null } : { data: null, error: { message: 'x' } }) })
  const error = await t.rejects(collections.createCollection('u', 'N', ['m1']))
  t.ok('collections: if the memories cannot be added the collection is not kept', !!error && calls.some((c) => c[0] === 'collections' && c[1] === 'delete') && error.message.includes('wasn’t created'))
}
{
  const { calls } = installFakeClient({ respond: (table) => (table === 'collections' ? { data: { id: 'c2', name: 'Empty' }, error: null } : { data: null, error: null }) })
  await collections.createCollection('u', 'Empty', [])
  t.ok('collections: an empty collection adds no links', !calls.some((c) => c[0] === 'collection_memories'))
  await collections.removeFromCollection('c1', 'm1')
  t.ok('collections: removing deletes by both ids', calls.some((c) => c[0] === 'eq' && c[1] === 'collection_id' && c[2] === 'c1') && calls.some((c) => c[0] === 'eq' && c[1] === 'memory_id' && c[2] === 'm1'))
}

// ---------- storage helpers ----------
const mine = 'https://project.supabase.co/storage/v1/object/public/avatars/u1/avatar-9.jpg'
t.ok('pictures: one from this project\'s storage is trusted', storage.trustedAvatarUrl(mine) === mine)
t.ok('pictures: an address on another site is never shown', storage.trustedAvatarUrl('https://evil.example/storage/v1/object/public/avatars/u1/a.jpg') === null)
t.ok('pictures: neither is a lookalike host, another bucket, or an empty value', storage.trustedAvatarUrl('https://project.supabase.co.evil.example/storage/v1/object/public/avatars/a.jpg') === null && storage.trustedAvatarUrl('https://project.supabase.co/storage/v1/object/public/memory-photos/a.jpg') === null && storage.trustedAvatarUrl(null) === null && storage.trustedAvatarUrl('') === null)
t.ok('pictures: the file path is read back out of a public address', storage.avatarPathFromUrl(`${mine}?t=1`) === 'u1/avatar-9.jpg' && storage.avatarPathFromUrl('https://elsewhere.com/pic.jpg') === null)

t.finish()
