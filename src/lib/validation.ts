// Small, readable validators. Each returns an error message, or null when valid.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const validateEmail = (v: string): string | null => {
  if (!v.trim()) return 'Enter your email.'
  return EMAIL_RE.test(v.trim()) ? null : 'That doesn’t look like a valid email.'
}

export const validateUsername = (v: string): string | null => {
  const s = v.trim()
  if (!s) return 'Choose a username.'
  if (s.length < 3) return 'Use at least 3 characters.'
  if (s.length > 20) return 'Keep it to 20 characters or fewer.'
  return /^[a-zA-Z0-9._]+$/.test(s) ? null : 'Letters, numbers, dots and underscores only.'
}

export const validatePassword = (v: string): string | null => {
  if (!v) return 'Create a password.'
  if (v.length < 8) return 'Use at least 8 characters.'
  return /[A-Za-z]/.test(v) && /\d/.test(v) ? null : 'Include at least one letter and one number.'
}

export const validateConfirm = (password: string, confirm: string): string | null => {
  if (!confirm) return 'Re-enter your password.'
  return password === confirm ? null : 'The passwords don’t match.'
}
