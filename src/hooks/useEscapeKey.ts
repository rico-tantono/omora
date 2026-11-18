import { useEffect } from 'react'

// Lets the Escape key close a dialog. Pass undefined to switch it off, for example while saving.
export function useEscapeKey(handler: (() => void) | undefined) {
  useEffect(() => {
    if (!handler) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handler])
}
