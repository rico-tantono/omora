import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { AuthError } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'
import { validateConfirm, validateEmail, validatePassword, validateUsername } from '../../lib/validation'
import { SakuraIcon } from '../../components/Motifs'
import Field from './Field'

interface Props {
  onSwitch: () => void
}

type FieldKey = 'username' | 'email' | 'password' | 'confirm'

export default function SignupForm({ onSwitch }: Props) {
  const { signUp, resendConfirmation, welcomeFor, dismissWelcome } = useAuth()
  const [values, setValues] = useState({ username: '', email: '', password: '', confirm: '' })
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    username: false,
    email: false,
    password: false,
    confirm: false,
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmEmailFor, setConfirmEmailFor] = useState<string | null>(null)
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resendError, setResendError] = useState('')

  const errors: Record<FieldKey, string | null> = {
    username: validateUsername(values.username),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    confirm: validateConfirm(values.password, values.confirm),
  }
  const show = (k: FieldKey) => (touched[k] ? errors[k] : null)
  const set = (k: FieldKey) => (v: string) => setValues((s) => ({ ...s, [k]: v }))
  const blur = (k: FieldKey) => () => setTouched((t) => ({ ...t, [k]: true }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched({ username: true, email: true, password: true, confirm: true })
    setFormError('')
    if (Object.values(errors).some(Boolean)) return

    setSubmitting(true)
    try {
      const result = await signUp({ username: values.username, email: values.email, password: values.password })
      if (result === 'confirmation-required') setConfirmEmailFor(values.email.trim())
    } catch (err) {
      setFormError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (welcomeFor) {
    return (
      <div className="py-2">
        <SakuraIcon className="mb-3 h-12 w-12 text-ember-500" strokeWidth={4} />
        <h1 className="font-display text-[1.9rem] leading-tight font-medium text-ember-900">
          Welcome, {welcomeFor}.
        </h1>
        <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-soft">
          Your map is ready. The first place is up to you.
        </p>
        <button
          type="button"
          onClick={dismissWelcome}
          className="mt-7 h-12 w-full rounded-lg bg-ember-500 font-semibold text-on-accent"
        >
          Open my map
        </button>
      </div>
    )
  }

  async function handleResend(email: string) {
    setResend('sending')
    setResendError('')
    try {
      await resendConfirmation(email)
      setResend('sent')
    } catch (err) {
      setResendError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
      setResend('idle')
    }
  }

  if (confirmEmailFor) {
    return (
      <div className="py-2">
        <SakuraIcon className="mb-3 h-12 w-12 text-ember-500" strokeWidth={4} />
        <h1 className="font-display text-[1.9rem] leading-tight font-medium text-ember-900">Check your email.</h1>
        <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-soft">
          We sent a confirmation link to <span className="font-medium text-ink">{confirmEmailFor}</span>. Open it, then log in.
        </p>
        <button type="button" onClick={onSwitch} className="mt-7 h-12 w-full rounded-lg bg-ember-500 font-semibold text-on-accent">
          Back to log in
        </button>
        <p className="mt-3 text-sm text-ink-soft">
          {resend === 'sent' ? (
            'Sent. Check your inbox for a new link.'
          ) : (
            <>
              Didn’t get it?{' '}
              <button
                type="button"
                onClick={() => handleResend(confirmEmailFor)}
                disabled={resend === 'sending'}
                className="inline-flex min-h-[44px] items-center font-semibold text-ember-700 underline underline-offset-4 disabled:opacity-60"
              >
                {resend === 'sending' ? 'Sending…' : 'Resend email'}
              </button>
            </>
          )}
        </p>
        {resendError && (
          <p role="alert" className="text-sm font-medium text-ember-700">
            {resendError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-[1.9rem] leading-[1.1] font-medium text-ember-900">
        Start collecting your little moments.
      </h1>
      <p className="mt-2 max-w-[34ch] text-[0.95rem] leading-relaxed text-ink-soft">
        Create your own map of the places that become part of your story.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <fieldset disabled={submitting} className="space-y-3.5">
          <Field id="su-username" label="Username" autoComplete="username" value={values.username} onChange={set('username')} onBlur={blur('username')} error={show('username')} />
          <Field id="su-email" label="Email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={set('email')} onBlur={blur('email')} error={show('email')} />
          <Field
            id="su-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={set('password')}
            onBlur={blur('password')}
            error={show('password')}
            hint="At least 8 characters, with a letter and a number."
          />
          <Field id="su-confirm" label="Confirm password" type="password" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} onBlur={blur('confirm')} error={show('confirm')} />
        </fieldset>

        {formError && (
          <p role="alert" className="mt-4 text-sm text-ember-700">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ember-500 font-semibold text-on-accent disabled:opacity-80"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {submitting ? 'Creating your map…' : 'Create account'}
        </button>
      </form>

      <p className="mt-3 text-sm text-ink-soft">
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} className="inline-flex min-h-[44px] items-center font-semibold text-ember-700 underline underline-offset-4">
          Log in
        </button>
      </p>
    </div>
  )
}
