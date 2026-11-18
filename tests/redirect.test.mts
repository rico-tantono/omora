import { createSuite } from './harness.ts'

const t = createSuite('Email link results')

let replaced: unknown[][] = []
function visit(hash: string) {
  replaced = []
  ;(globalThis as any).window = {
    location: { hash, search: '', pathname: '/' },
    history: { replaceState: (...args: unknown[]) => replaced.push(args) },
  }
}

// The module reads the address once when it loads, so each case loads a fresh copy.
let version = 0
const load = async () => (await import(`../src/lib/authRedirect.ts?v=${++version}`)).authRedirect

visit('#access_token=abc&refresh_token=def&token_type=bearer&type=signup')
let result = await load()
t.ok('a confirmation link is recognised', result.confirmed === true && result.error === null)
t.ok('the address is left alone so the client can sign the user in', replaced.length === 0)

visit('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=')
result = await load()
t.ok('an expired link gives a clear message', result.confirmed === false && /expired or was already used/.test(result.error))
t.ok('the error is removed from the address bar', replaced.length === 1 && (replaced[0] as any)[2] === '/')

visit('#error=server_error&error_code=unexpected_failure')
result = await load()
t.ok('any other link error gives a generic message', result.confirmed === false && /didn’t work/.test(result.error))

visit('')
result = await load()
t.ok('a normal visit is untouched', result.confirmed === false && result.error === null && replaced.length === 0)

visit('#access_token=abc&type=recovery')
result = await load()
t.ok('other link types are not treated as sign-up confirmation', result.confirmed === false)

t.finish()
