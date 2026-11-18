import L from 'leaflet'
import type { OwnerKind } from '../lib/identity'
import { initialsOf } from '../lib/text'

// Custom HTML pins avoid Leaflet's default marker images, which are a known headache with bundlers like Vite.
// The anchor is the pin's tip (the rotated square's bottom corner).
export const searchPin = L.divIcon({
  className: '',
  html: '<div class="memory-pin search"></div>',
  iconSize: [40, 40],
  iconAnchor: [20, 48],
})

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const iconCache = new Map<string, L.DivIcon>()

interface AvatarIconInput {
  kind: OwnerKind
  name: string
  avatar?: string
  /** Number of memories sharing this exact spot */
  stackCount: number
}

// One shared silhouette: an avatar frame with a small tail. Kind decides the
// frame shape and ring color (see .avatar-pin in index.css). The selected
// state is a CSS class toggled on the element, so it can animate smoothly.
export function createAvatarIcon({ kind, name, avatar, stackCount }: AvatarIconInput): L.DivIcon {
  const key = `${kind}|${name}|${avatar ?? ''}|${stackCount}`
  const cached = iconCache.get(key)
  if (cached) return cached

  const initials = escapeHtml(initialsOf(name, kind === 'group' ? 2 : 1))
  const img = avatar
    ? `<img src="${escapeHtml(avatar)}" alt="" draggable="false" onerror="this.remove()" />`
    : ''
  const stack = stackCount > 1 ? `<span class="avatar-pin__stack">${stackCount}</span>` : ''

  const icon = L.divIcon({
    className: '',
    html: `<div class="avatar-pin is-${kind}"><span class="avatar-pin__tail"></span><span class="avatar-pin__frame"><span class="avatar-pin__initials">${initials}</span>${img}</span>${stack}</div>`,
    iconSize: [44, 52],
    iconAnchor: [22, 52],
  })
  iconCache.set(key, icon)
  return icon
}
