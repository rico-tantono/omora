import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { AuthError } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'
import { validateEmail } from '../../lib/validation'
import Field from './Field'

interface Props {
  onSwitch: () => void
}

export default function LoginForm({ onSwitch }: Props) {
  const { logIn, resendConfirmation, notice, linkError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle')

  const errors = {
    email: validateEmail(email),
    password: password ? null : 'Enter your password.',
  }
  const show = (k: 'email' | 'password') => (touched[k] ? errors[k] : null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched({ email: true, password: true })
    setFormError('')
    if (errors.email || errors.password) return

    setSubmitting(true)
    try {
      await logIn({ email, password })
    } catch (err) {
      setFormError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
      setNeedsConfirmation(err instanceof AuthError && err.code === 'email-not-confirmed')
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (errors.email) {
      setTouched((t) => ({ ...t, email: true }))
      return
    }
    setResend('sending')
    setFormError('')
    try {
      await resendConfirmation(email)
      setResend('sent')
    } catch (err) {
      setFormError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
      setResend('idle')
    }
  }

  return (
    <div>
      <h1 className="font-display text-[2.15rem] leading-[1.08] font-medium text-white">Some places stay with us.</h1>
      <p className="mt-3 max-w-[30ch] text-[0.98rem] leading-relaxed text-white/80">
        Your little world of places, people, and memories is waiting.
      </p>
      {(linkError ?? notice) && (
        <p role="status" className="mt-4 text-sm font-medium text-white/90">
          {linkError ?? notice}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
        <fieldset disabled={submitting} className="space-y-4">
          <Field
            id="login-email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            tone="dark"
            value={email}
            onChange={setEmail}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={show('email')}
          />
          <Field
            id="login-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            tone="dark"
            value={password}
            onChange={setPassword}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            error={show('password')}
          />
        </fieldset>

        {formError && (
          <p role="alert" className="text-sm text-[#FFC9BD]">
            {formError}
          </p>
        )}

        {(needsConfirmation || linkError) && (
          <p className="text-sm text-white/80">
            {resend === 'sent' ? (
              'Sent. Check your inbox for a new link.'
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resend === 'sending'}
                className="inline-flex min-h-[44px] items-center font-semibold text-white underline underline-offset-4 disabled:opacity-60"
              >
                {resend === 'sending' ? 'Sending…' : 'Resend confirmation email'}
              </button>
            )}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ember-500 font-semibold text-on-accent disabled:opacity-80"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-5 text-sm text-white/75">
        New to OMORA?{' '}
        <button type="button" onClick={onSwitch} className="inline-flex min-h-[44px] items-center font-semibold text-white underline underline-offset-4">
          Create an account
        </button>
      </p>
    </div>
  )
}
