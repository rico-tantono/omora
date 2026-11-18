import { createSuite } from './harness.ts'
import { installFakeClient } from './fakes/client.ts'
import * as auth from '../src/services/auth.ts'

const t = createSuite('Authentication service')
;(globalThis as any).window = { location: { origin: 'http://localhost:5173' } }

const signIn = (error: any) => installFakeClient({ auth: { signIn: () => ({ error }) } })
const credentials = { email: 'a@b.co', password: 'pw' }

// ---- login errors become friendly messages ----
for (const [name, error, code] of [
  ['wrong password', { code: 'invalid_credentials', status: 400, message: 'x' }, 'invalid-credentials'],
  ['unconfirmed email', { code: 'email_not_confirmed', status: 400, message: 'x' }, 'email-not-confirmed'],
  ['offline', { status: 0, message: 'Failed to fetch' }, 'network'],
  ['HTTP 429', { status: 429, message: 'slow down' }, 'rate-limited'],
  ['email send limit', { code: 'over_email_send_rate_limit', status: 400, message: 'x' }, 'rate-limited'],
  ['anything else', { code: 'weird', status: 500, message: 'boom' }, 'unknown'],
] as const) {
  signIn(error)
  t.ok(`login: ${name} -> ${code}`, (await t.rejects(auth.logIn(credentials)))?.code === code)
}
{
  const { calls } = installFakeClient()
  await auth.logIn({ email: '  a@b.co ', password: 'pw' })
  t.ok('login: the email is trimmed', calls[0][1].email === 'a@b.co')
}

// ---- sign-up outcomes ----
const input = { username: ' nadia ', email: 'a@b.co', password: 'pw12345a' }
{
  const { calls } = installFakeClient({ rpc: () => ({ data: false, error: null }) })
  const error = await t.rejects(auth.signUp(input))
  t.ok('signup: a taken username stops before the account is created', error?.code === 'username-taken' && !calls.some((c) => c[0] === 'signUp'))
}
{
  installFakeClient({ rpc: () => ({ data: null, error: { message: 'function not found' } }) })
  t.ok('signup: a failing availability check shows a friendly error', (await t.rejects(auth.signUp(input)))?.code === 'unknown')
}
{
  const { calls } = installFakeClient({
    rpc: () => ({ data: true, error: null }),
    auth: { signUp: () => ({ data: { user: { identities: [{}] }, session: { user: {} } }, error: null }) },
  })
  t.ok('signup: a session means signed in', (await auth.signUp(input)) === 'signed-in')
  const sent = calls.find((c) => c[0] === 'signUp')[1]
  t.ok('signup: the username is trimmed into metadata and the link returns to the app', sent.options.data.username === 'nadia' && sent.options.emailRedirectTo === 'http://localhost:5173')
}
{
  installFakeClient({ rpc: () => ({ data: true, error: null }), auth: { signUp: () => ({ data: { user: { identities: [{}] }, session: null }, error: null }) } })
  t.ok('signup: no session means confirm your email', (await auth.signUp(input)) === 'confirmation-required')
}
{
  installFakeClient({ rpc: () => ({ data: true, error: null }), auth: { signUp: () => ({ data: { user: { identities: [] }, session: null }, error: null }) } })
  t.ok('signup: an existing address (no identities) -> email-taken', (await t.rejects(auth.signUp(input)))?.code === 'email-taken')
}
{
  installFakeClient({ rpc: () => ({ data: true, error: null }), auth: { signUp: () => ({ data: { user: null, session: null }, error: { code: 'user_already_exists', status: 422, message: 'x' } }) } })
  t.ok('signup: user_already_exists -> email-taken', (await t.rejects(auth.signUp(input)))?.code === 'email-taken')
}

// ---- resend and logout ----
{
  const { calls } = installFakeClient()
  await auth.resendConfirmation('  a@b.co ')
  t.ok('resend: trimmed email, sign-up type, link back to the app', calls[0][1].type === 'signup' && calls[0][1].email === 'a@b.co' && calls[0][1].options.emailRedirectTo === 'http://localhost:5173')
}
{
  installFakeClient({ auth: { resend: () => ({ error: { code: 'over_email_send_rate_limit', status: 429, message: 'x' } }) } })
  t.ok('resend: rate limit -> rate-limited', (await t.rejects(auth.resendConfirmation('a@b.co')))?.code === 'rate-limited')
}
{
  const { calls } = installFakeClient({ auth: { signOut: (a: any) => (a?.scope === 'local' ? { error: null } : { error: { message: 'offline' } }) } })
  await auth.signOut()
  t.ok('logout: if the server cannot be reached the session still ends on this device', calls.filter((c) => c[0] === 'signOut').map((c) => c[1]).join() === 'global,local')
}

t.finish()
