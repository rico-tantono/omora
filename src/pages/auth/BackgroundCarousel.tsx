import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../../lib/motion'

// The three provided photographs, in order.
const IMAGES = [
  'https://images.unsplash.com/photo-1471093507554-1b18de49c890?q=80&w=1471&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
  'https://images.unsplash.com/photo-1743081139600-e699807e48cd?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
  'https://images.unsplash.com/photo-1495837174058-628aafc7d610?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
]
const INTERVAL_MS = 8000

// Slow crossfade between photos. A photo only becomes current once it has
// loaded, so a slow connection never shows a blank frame.
export default function BackgroundCarousel() {
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState<boolean[]>(() => IMAGES.map(() => false))
  const loadedRef = useRef(loaded)

  useEffect(() => {
    IMAGES.forEach((src, i) => {
      const img = new Image()
      img.onload = () => {
        const next = [...loadedRef.current]
        next[i] = true
        loadedRef.current = next
        setLoaded(next)
      }
      img.src = src
    })
  }, [])

  useEffect(() => {
    if (prefersReducedMotion()) return // stay on the first photo
    const id = window.setInterval(() => {
      setCurrent((c) => {
        for (let step = 1; step <= IMAGES.length; step++) {
          const candidate = (c + step) % IMAGES.length
          if (loadedRef.current[candidate]) return candidate
        }
        return c
      })
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="absolute inset-0 bg-ember-900" aria-hidden="true">
      {IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[2600ms] ease-in-out ${
            loaded[i] && current === i ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  )
}
