import { useEffect, useRef, useState } from 'react'
import { ToriiIcon } from '../../components/Motifs'
import BackgroundCarousel from './BackgroundCarousel'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'

type Mode = 'login' | 'signup'

// One persistent photo background; only the panel on top changes between
// log in (text over the photo) and sign up (a paper sheet rising from below).
export default function AuthFlow() {
  const [mode, setMode] = useState<Mode>('login')
  const [visible, setVisible] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  function switchTo(next: Mode) {
    if (next === mode) return
    setVisible(false)
    timerRef.current = window.setTimeout(() => {
      setMode(next)
      setVisible(true)
      scrollRef.current?.scrollTo({ top: 0 })
    }, 350)
  }

  return (
    <div className="animate-fade fixed inset-0 overflow-hidden bg-ink text-white">
      <BackgroundCarousel />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(35,24,21,0.5) 0%, rgba(35,24,21,0) 22%), radial-gradient(90% 45% at 0% 100%, rgba(255, 107, 74,0.32) 0%, rgba(255, 107, 74,0) 70%), linear-gradient(to top, rgba(35,24,21,0.95) 0%, rgba(35,24,21,0.72) 45%, rgba(35,24,21,0.08) 100%)',
        }}
      />

      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full flex-col">
          <header className="pt-safe px-6">
            <div className="flex items-center gap-2.5 pt-5">
              <ToriiIcon className="h-6 w-6 text-white" />
              <p className="font-display text-lg font-medium tracking-[0.3em] text-white">OMORA</p>
            </div>
          </header>

          <div className="min-h-[7dvh] flex-1" />

          <div
            className={`transition duration-[350ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] ${
              visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
          >
            {mode === 'login' ? (
              <div className="px-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
                <LoginForm onSwitch={() => switchTo('signup')} />
              </div>
            ) : (
              <div
                className="rounded-t-2xl bg-paper px-6 pt-7 text-ink"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
              >
                <SignupForm onSwitch={() => switchTo('login')} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
