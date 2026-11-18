import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AvatarChange, Profile, ProfileChanges, Visibility } from '../types'
import { authRedirect } from '../lib/authRedirect'
import { getSupabase, missingSupabaseEnv } from '../lib/supabase'
import * as authService from '../services/auth'
import { deleteAccount as deleteAccountData } from '../services/account'
import { ProfileError, loadOrCreateProfile, updateProfile, updateProfileVisibility } from '../services/profiles'

export type AuthStatus = 'misconfigured' | 'loading' | 'signed-out' | 'profile-error' | 'signed-in'

interface AuthContextValue {
  status: AuthStatus
  profile: Profile | null
  /** Set when a session ended without the user asking for it (expiry, or logout in another tab) */
  notice: string | null
  /** Why an email link failed, when the user arrived from one */
  linkError: string | null
  /** True while the "email confirmed" screen should be shown */
  emailConfirmed: boolean
  /** True once a sign-in or sign-up has been submitted in this visit */
  authAttempted: boolean
  /** Username to greet after sign-up, until the welcome screen is dismissed */
  welcomeFor: string | null
  signUp: (input: { username: string; email: string; password: string }) => Promise<authService.SignUpResult>
  logIn: (input: { email: string; password: string }) => Promise<void>
  logOut: () => Promise<void>
  resendConfirmation: (email: string) => Promise<void>
  dismissEmailConfirmed: () => void
  /** Resolves to an error message, or null when saved */
  saveProfile: (changes: ProfileChanges, avatar?: AvatarChange) => Promise<string | null>
  /** Who can find you in search; resolves to an error message, or null when saved */
  saveVisibility: (visibility: Visibility) => Promise<string | null>
  /** Deletes the account and everything in it; resolves to an error message, or null (you are then signed out) */
  deleteAccount: () => Promise<string | null>
  retryProfile: () => void
  dismissWelcome: () => void
}

interface ProfileState {
  userId: string
  profile: Profile | null
}

const SIGNED_OUT_NOTICE = 'You were signed out. Please log in again.'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = missingSupabaseEnv.length === 0

  // undefined = still restoring the session; null = no session
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profileState, setProfileState] = useState<ProfileState | null>(null)
  const [profileAttempt, setProfileAttempt] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [authAttempted, setAuthAttempted] = useState(false)
  const [welcomeFor, setWelcomeFor] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(authRedirect.error)
  const [emailConfirmed, setEmailConfirmed] = useState(authRedirect.confirmed)
  const hadSession = useRef(false)
  const loggingOut = useRef(false)

  // The only auth listener in the app. It also delivers the restored session on load.
  useEffect(() => {
    if (!configured) return
    const { data } = getSupabase().auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        if (hadSession.current && !loggingOut.current) setNotice(SIGNED_OUT_NOTICE)
        loggingOut.current = false
      }
      hadSession.current = nextSession !== null
      // Only store the session here; awaiting other Supabase calls inside this callback can deadlock.
      setSession(nextSession)
    })
    return () => data.subscription.unsubscribe()
  }, [configured])

  // Reloads only when the signed-in user changes, not on every token refresh.
  const user = session?.user ?? null
  const userId = user?.id
  useEffect(() => {
    if (!user) {
      setProfileState(null)
      return
    }
    let cancelled = false
    loadOrCreateProfile(user)
      .then((profile) => {
        if (!cancelled) setProfileState({ userId: user.id, profile })
      })
      .catch((error) => {
        console.error('Loading the profile failed:', error)
        if (!cancelled) setProfileState({ userId: user.id, profile: null })
      })
    return () => {
      cancelled = true
    }
  }, [userId, profileAttempt])

  const profile = userId && profileState?.userId === userId ? profileState.profile : null

  let status: AuthStatus
  if (!configured) status = 'misconfigured'
  else if (session === undefined) status = 'loading'
  else if (session === null) status = 'signed-out'
  else if (profileState?.userId !== session.user.id) status = 'loading'
  else status = profile ? 'signed-in' : 'profile-error'

  const signUp = useCallback<AuthContextValue['signUp']>(async (input) => {
    setNotice(null)
    setAuthAttempted(true)
    const result = await authService.signUp(input)
    if (result === 'signed-in') setWelcomeFor(input.username.trim())
    return result
  }, [])

  const logIn = useCallback<AuthContextValue['logIn']>(async (input) => {
    setNotice(null)
    setLinkError(null)
    setAuthAttempted(true)
    await authService.logIn(input)
  }, [])

  const logOut = useCallback(async () => {
    loggingOut.current = true
    setAuthAttempted(false)
    setWelcomeFor(null)
    await authService.signOut()
  }, [])

  const saveProfile = useCallback<AuthContextValue['saveProfile']>(
    async (changes, avatar) => {
      if (!userId) return 'You are signed out.'
      try {
        setProfileState({ userId, profile: await updateProfile(userId, changes, avatar, profile?.avatarUrl) })
        return null
      } catch (error) {
        return error instanceof ProfileError ? error.message : 'Could not save your changes. Please try again.'
      }
    },
    [userId, profile?.avatarUrl],
  )

  const saveVisibility = useCallback(
    async (visibility: Visibility): Promise<string | null> => {
      if (!userId) return 'You are signed out.'
      try {
        await updateProfileVisibility(userId, visibility)
        setProfileState((state) => (state?.profile ? { ...state, profile: { ...state.profile, visibility } } : state))
        return null
      } catch (error) {
        return error instanceof ProfileError ? error.message : 'Could not save your setting. Please try again.'
      }
    },
    [userId],
  )

  const deleteAccount = useCallback(async (): Promise<string | null> => {
    if (!userId) return 'You are signed out.'
    try {
      await deleteAccountData(userId)
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not delete your account. Please try again.'
    }
    await logOut()
    return null
  }, [userId, logOut])

  const retryProfile = useCallback(() => {
    setProfileState(null)
    setProfileAttempt((attempt) => attempt + 1)
  }, [])

  const resendConfirmation = useCallback(async (email: string) => {
    await authService.resendConfirmation(email)
    setLinkError(null)
  }, [])

  const dismissWelcome = useCallback(() => setWelcomeFor(null), [])
  const dismissEmailConfirmed = useCallback(() => setEmailConfirmed(false), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      profile,
      notice,
      linkError,
      emailConfirmed,
      authAttempted,
      welcomeFor,
      signUp,
      logIn,
      logOut,
      resendConfirmation,
      dismissEmailConfirmed,
      saveProfile,
      saveVisibility,
      deleteAccount,
      retryProfile,
      dismissWelcome,
    }),
    [
      status,
      profile,
      notice,
      linkError,
      emailConfirmed,
      authAttempted,
      welcomeFor,
      signUp,
      logIn,
      logOut,
      resendConfirmation,
      dismissEmailConfirmed,
      saveProfile,
      saveVisibility,
      deleteAccount,
      retryProfile,
      dismissWelcome,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}
