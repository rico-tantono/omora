import { createSuite } from './harness.ts'
import { defaultAvatarUri, hashString, personAvatar } from '../src/lib/avatar.ts'
import { memoriesOnThisDay, yearsAgo } from '../src/lib/onThisDay.ts'
import { validateConfirm, validateEmail, validatePassword, validateUsername } from '../src/lib/validation.ts'
import { randomId } from '../src/lib/id.ts'
import { initialsOf, firstName } from '../src/lib/text.ts'
import { formatDate } from '../src/lib/format.ts'

const t = createSuite('Small helpers')

// ---- default pictures ----
const users = ['kenji.sketch', 'ayu.rewinds', 'bima.trails', 'luna.vinyl', 'raka.eats', 'sasha.reads', 'demo', 'nadia.walks']
t.ok('default pictures: sample usernames get different colors', new Set(users.map((u) => defaultAvatarUri(u))).size === users.length)
t.ok('default pictures: the same username always looks the same (case and spaces ignored)', defaultAvatarUri('Demo ') === defaultAvatarUri('demo'))
const svg = decodeURIComponent(defaultAvatarUri('demo').split(',')[1])
t.ok('default pictures: the silhouette is a head and shoulders only, no hair', (svg.match(/fill="url\(#p\)"/g) ?? []).length === 2)
t.ok('default pictures: a custom picture wins', personAvatar('demo', 'https://x/y.jpg') === 'https://x/y.jpg' && personAvatar('demo').startsWith('data:image/svg+xml'))
t.ok('hashing is stable', hashString('abc') === hashString('abc') && hashString('abc') !== hashString('abd'))

// ---- On this day ----
{
  const today = new Date('2026-10-26T12:00:00')
  const m = (id: string, visitDate: string) => ({ id, visitDate }) as any
  const found = memoriesOnThisDay([m('a', '2025-10-26'), m('b', '2026-10-26'), m('c', '2024-10-26'), m('d', '2025-10-25'), m('e', '2026-01-09')], today)
  t.ok('on this day: only earlier years on the same day, newest first', found.map((x: any) => x.id).join() === 'a,c')
  t.ok('on this day: counts the years', found.map((x: any) => yearsAgo(x.visitDate, today)).join() === '1,2')
}

// ---- form validation ----
t.ok('email: valid and invalid', validateEmail('a@b.co') === null && validateEmail('nope') !== null && validateEmail('') !== null)
t.ok('username: 3-20 letters, numbers, dots and underscores', validateUsername('nadia.w_1') === null && validateUsername('ab') !== null && validateUsername('a'.repeat(21)) !== null && validateUsername('no spaces') !== null && validateUsername('émoji') !== null)
t.ok('password: 8+ characters with a letter and a number', validatePassword('abcdefg1') === null && validatePassword('short1') !== null && validatePassword('allletters') !== null && validatePassword('12345678') !== null)
t.ok('confirm: must match', validateConfirm('abc12345', 'abc12345') === null && validateConfirm('abc12345', 'abc12346') !== null && validateConfirm('abc12345', '') !== null)

// ---- ids, text, dates ----
const ids = new Set(Array.from({ length: 2000 }, () => randomId()))
t.ok('ids: unique, version 4 shape, no secure-context API needed', ids.size === 2000 && [...ids].every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)))
t.ok('text: initials and first names', initialsOf('Nadia Rahman', 2) === 'NR' && initialsOf('kenji.sketch') === 'K' && initialsOf('') === '?' && firstName('Nadia Rahman') === 'Nadia')
t.ok('dates: read in local time, not shifted by timezone', formatDate('2026-01-09') === 'January 9, 2026')

t.finish()
