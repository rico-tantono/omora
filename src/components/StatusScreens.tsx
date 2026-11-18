import type { ReactNode } from 'react'
import type { AuthStatus } from '../context/AuthContext'
import { SakuraIcon, ToriiIcon } from './Motifs'

function ScreenShell({ children }: { children?: ReactNode }) {
  return (
    <div className="app-bg animate-fade flex h-dvh flex-col items-center justify-center px-8 text-center">
      <div className="flex items-center gap-2.5 text-ember-700">
        <ToriiIcon className="h-6 w-6" />
        <p className="font-display text-lg font-medium tracking-[0.3em] text-ember-900">OMORA</p>
      </div>
      {children}
    </div>
  )
}

const primaryButton = 'mt-6 h-12 rounded-lg bg-ember-500 px-6 font-semibold text-on-accent'

export function SplashScreen() {
  return (
    <ScreenShell>
      <span className="sr-only" role="status">
        Loading
      </span>
    </ScreenShell>
  )
}

export function SetupErrorScreen({ missing }: { missing: string[] }) {
  return (
    <ScreenShell>
      <h1 className="font-display mt-8 text-2xl font-medium text-ember-900">Almost there</h1>
      <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-ink-soft">
        OMORA needs these environment variables. Add them to <code>.env.local</code>, then restart the dev server.
      </p>
      <ul className="mt-4 space-y-1 text-sm font-medium text-ink">
        {missing.map((name) => (
          <li key={name}>
            <code>{name}</code>
          </li>
        ))}
      </ul>
    </ScreenShell>
  )
}

export function ProfileErrorScreen({ onRetry, onLogOut }: { onRetry: () => void; onLogOut: () => void }) {
  return (
    <ScreenShell>
      <h1 className="font-display mt-8 text-2xl font-medium text-ember-900">We couldn’t load your profile</h1>
      <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-ink-soft">
        Check your connection and try again. If it keeps happening, make sure the database setup has been run.
      </p>
      <button type="button" onClick={onRetry} className={primaryButton}>
        Try again
      </button>
      <button type="button" onClick={onLogOut} className="mt-2 h-11 px-4 text-sm font-semibold text-ember-700 underline underline-offset-4">
        Log out
      </button>
    </ScreenShell>
  )
}

export function EmailConfirmedScreen({ status, onContinue }: { status: AuthStatus; onContinue: () => void }) {
  const signedIn = status === 'signed-in'
  const loading = status === 'loading'
  return (
    <ScreenShell>
      <SakuraIcon className="mt-8 h-14 w-14 text-ember-500" strokeWidth={4} />
      <h1 className="font-display mt-4 text-[1.9rem] leading-tight font-medium text-ember-900">Email confirmed.</h1>
      <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-ink-soft">
        {signedIn
          ? 'Thank you. Your account is verified and you’re signed in.'
          : loading
            ? 'Thank you. Signing you in…'
            : 'Thank you. Your account is verified. Log in to continue.'}
      </p>
      <button type="button" onClick={onContinue} disabled={loading} className={`${primaryButton} disabled:opacity-60`}>
        {signedIn ? 'Open my map' : loading ? 'Just a moment' : 'Log in'}
      </button>
    </ScreenShell>
  )
}
