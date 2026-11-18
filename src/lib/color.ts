// Turn a color into a dark, text-safe gradient set (white text stays readable).
export interface Tone {
  a: string
  b: string
  c: string
  hi: string
  lo: string
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${a})`

function toneFromHue(h: number, s: number): Tone {
  const sat = Math.min(Math.max(s, 0.38), 0.78)
  return {
    a: hsl(h, sat, 0.34),
    b: hsl(h, sat, 0.28),
    c: hsl(h, sat, 0.22),
    hi: hsl(h, Math.min(sat + 0.05, 0.85), 0.5, 0.55),
    lo: hsl(h, sat, 0.14, 0.85),
  }
}

export function toneFromRgb(r: number, g: number, b: number): Tone {
  const [h, s] = rgbToHsl(r, g, b)
  return toneFromHue(h, s)
}

export function toneFromSeed(seed: string): Tone {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360
  return toneFromHue(h, 0.6)
}
