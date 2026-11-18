import { missingSupabaseEnv } from './lib/supabase'
import { useAuth } from './context/AuthContext'
import AuthFlow from './pages/auth/AuthFlow'
import MainApp from './MainApp'
import { EmailConfirmedScreen, ProfileErrorScreen, SetupErrorScreen, SplashScreen } from './components/StatusScreens'

export default function App() {
  const { status, profile, authAttempted, welcomeFor, emailConfirmed, dismissEmailConfirmed, saveProfile, saveVisibility, deleteAccount, logOut, retryProfile } =
    useAuth()

  if (status === 'misconfigured') return <SetupErrorScreen missing={missingSupabaseEnv} />
  if (status === 'profile-error') return <ProfileErrorScreen onRetry={retryProfile} onLogOut={logOut} />
  if (emailConfirmed) return <EmailConfirmedScreen status={status} onContinue={dismissEmailConfirmed} />

  // Keep the auth screen mounted while a sign-in or sign-up finishes, so its spinner and welcome message survive.
  const finishingAuth = authAttempted && (status === 'loading' || welcomeFor !== null)
  if (status === 'signed-out' || finishingAuth) return <AuthFlow />

  if (status === 'loading' || !profile) return <SplashScreen />
  return <MainApp profile={profile} onSaveProfile={saveProfile} onSaveVisibility={saveVisibility} onDeleteAccount={deleteAccount} onLogout={logOut} />
}
