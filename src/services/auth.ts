import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'
import { isUsernameAvailable } from './profiles'

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'email-not-confirmed'
  | 'email-taken'
  | 'username-taken'
  | 'rate-limited'
  | 'network'
  | 'unknown'

const MESSAGES: Record<AuthErrorCode, string> = {
  'invalid-credentials': 'That email and password don’t match.',
  'email-not-confirmed': 'Confirm your email first. We sent you a link when you signed up.',
  'email-taken': 'An account with this email already exists. Try logging in instead.',
  'username-taken': 'That username is taken. Try another one.',
  'rate-limited': 'Too many attempts. Wait a moment and try again.',
  network: 'Couldn’t reach the server. Check your connection and try again.',
  unknown: 'Something went wrong. Please try again.',
}

// The message is safe to show to the user as is.
export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode) {
    super(MESSAGES[code])
    this.code = code
  }
}

function classify(error: SupabaseAuthError): AuthError {
  switch (error.code) {
    case 'invalid_credentials':
      return new AuthError('invalid-credentials')
    case 'email_not_confirmed':
      return new AuthError('email-not-confirmed')
    case 'user_already_exists':
    case 'email_exists':
      return new AuthError('email-taken')
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new AuthError('rate-limited')
  }
  if (error.status === 429) return new AuthError('rate-limited')
  if (error.status === 0 || /failed to fetch|network/i.test(error.message)) return new AuthError('network')
  console.error('Unexpected auth error:', error)
  return new AuthError('unknown')
}

const redirectUrl = () => window.location.origin

export type SignUpResult = 'signed-in' | 'confirmation-required'

export async function signUp(input: { username: string; email: string; password: string }): Promise<SignUpResult> {
  const username = input.username.trim()

  let available: boolean
  try {
    available = await isUsernameAvailable(username)
  } catch (error) {
    console.error('Username availability check failed:', error)
    throw new AuthError('unknown')
  }
  if (!available) throw new AuthError('username-taken')

  const { data, error } = await getSupabase().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { username }, emailRedirectTo: redirectUrl() },
  })
  if (error) throw classify(error)

  // With email confirmation on, an address that already exists comes back as a user without identities.
  if (data.user?.identities?.length === 0) throw new AuthError('email-taken')

  return data.session ? 'signed-in' : 'confirmation-required'
}

export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: redirectUrl() },
  })
  if (error) throw classify(error)
}

export async function logIn(input: { email: string; password: string }): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  })
  if (error) throw classify(error)
}

export async function signOut(): Promise<void> {
  const auth = getSupabase().auth
  const { error } = await auth.signOut()
  // If the server can't be reached, still end the session on this device.
  if (error) await auth.signOut({ scope: 'local' })
}
