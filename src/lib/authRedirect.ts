// After someone opens an email link, Supabase sends them back to the app with the result in the URL hash.
// This is read once, when the app loads and before the Supabase client starts, because the client
// removes the hash after it signs the user in.
export interface AuthRedirect {
  confirmed: boolean
  error: string | null
}

const EXPIRED_MESSAGE = 'That confirmation link has expired or was already used. Request a new one below.'
const GENERIC_MESSAGE = 'That email link didn’t work. Request a new one below.'

function readAuthRedirect(): AuthRedirect {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  if (params.has('error') || params.has('error_code')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    return { confirmed: false, error: params.get('error_code') === 'otp_expired' ? EXPIRED_MESSAGE : GENERIC_MESSAGE }
  }

  return { confirmed: params.get('type') === 'signup' && params.has('access_token'), error: null }
}

export const authRedirect = readAuthRedirect()
