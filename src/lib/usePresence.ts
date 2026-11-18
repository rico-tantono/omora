import { useEffect, useState } from 'react'

// Keeps an element mounted long enough to play its exit transition.
export function usePresence(show: boolean, exitMs = 350) {
  const [mounted, setMounted] = useState(show)
  const [visible, setVisible] = useState(show)

  useEffect(() => {
    if (show) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = window.setTimeout(() => setMounted(false), exitMs)
    return () => window.clearTimeout(t)
  }, [show, exitMs])

  return { mounted, visible }
}
