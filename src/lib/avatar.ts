// Default profile pictures: a frosted-glass silhouette on a color chosen from the username.
// Same username -> same color everywhere (lists, owner chips, map pins),
// different usernames -> (almost always) different colors, like Spotify's defaults.

const PALETTE_SIZE = 28

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

// 28 muted, evenly spread hues (stepped by 9 so neighbors differ), three lightness levels
const paletteEntry = (i: number) => ({
  h: ((i * 9) % PALETTE_SIZE) * (360 / PALETTE_SIZE),
  s: 0.5,
  l: [0.44, 0.49, 0.4][i % 3],
})

// FNV-1a with a final mix: spreads similar usernames across the palette
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return h >>> 0
}

const entryFor = (username: string) => paletteEntry(hashString(username.trim().toLowerCase()) % PALETTE_SIZE)

// A frosted-glass default: soft blurred color fields behind a frosted pane,
// with a translucent glass silhouette on top. Pure SVG, no external files.
function defaultAvatarSvg(username: string): string {
  const { h, s, l } = entryFor(username)
  const base = hslToHex(h, s, l)
  const light = hslToHex((h + 22) % 360, Math.min(s + 0.15, 0.85), Math.min(l + 0.2, 0.78))
  const deep = hslToHex((h + 338) % 360, s, Math.max(l - 0.16, 0.2))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
    `<defs>` +
    `<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>` +
    `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .16 0"/></filter>` +
    `<linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".78"/><stop offset="1" stop-color="#fff" stop-opacity=".34"/></linearGradient>` +
    `<linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity=".14"/></linearGradient>` +
    `</defs>` +
    `<rect width="128" height="128" fill="${base}"/>` +
    `<circle cx="34" cy="30" r="46" fill="${light}" filter="url(#b)"/>` +
    `<circle cx="102" cy="108" r="52" fill="${deep}" filter="url(#b)"/>` +
    `<rect width="128" height="128" fill="url(#f)"/>` +
    `<rect width="128" height="128" filter="url(#n)"/>` +
    `<path d="M20 128 C20 100 40 88 64 88 C88 88 108 100 108 128Z" fill="url(#p)" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>` +
    `<circle cx="64" cy="54" r="21" fill="url(#p)" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>` +
    `</svg>`
  )
}

export const defaultAvatarUri = (username: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(defaultAvatarSvg(username || '?'))}`

/** The picture to show for a person: their own, or the default for their username */
export const personAvatar = (username: string, custom?: string) => custom ?? defaultAvatarUri(username)
