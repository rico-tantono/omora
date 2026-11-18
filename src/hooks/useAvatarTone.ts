import { useEffect, useState } from 'react'
import { toneFromRgb, toneFromSeed, type Tone } from '../lib/color'

const cache = new Map<string, Tone>()

// The dominant color of an image, as a dark gradient set. Falls back to a color
// from the name while loading, or if the image can't be read.
export function useAvatarTone(src: string | undefined, seed: string): Tone {
  const [tone, setTone] = useState<Tone>(() => (src && cache.get(src)) || toneFromSeed(seed))

  useEffect(() => {
    if (!src) return setTone(toneFromSeed(seed))
    const cached = cache.get(src)
    if (cached) return setTone(cached)

    let cancelled = false
    const img = new Image()
    img.onload = () => {
      try {
        const size = 24
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        // Average the pixels, favoring saturated mid-tones over near-white and near-black
        let r = 0, g = 0, b = 0, total = 0
        for (let i = 0; i < data.length; i += 4) {
          const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]]
          const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb)
          const lum = (max + min) / 510
          const weight = (max - min) / 255 * (1 - Math.abs(lum - 0.5) * 1.6) + 0.02
          r += pr * weight; g += pg * weight; b += pb * weight; total += weight
        }
        if (cancelled || total === 0) return
        const next = toneFromRgb(r / total, g / total, b / total)
        cache.set(src, next)
        setTone(next)
      } catch {
        /* unreadable image: keep the fallback */
      }
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src, seed])

  return tone
}
