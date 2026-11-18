import type { GroupAvatarKey } from '../types'

const base = `${import.meta.env?.BASE_URL ?? '/'}avatars/groups`

// Pictures to pick from until a group uploads its own. The key is what the database stores.
export const GROUP_AVATAR_PRESETS: { key: GroupAvatarKey; label: string; src: string }[] = [
  { key: 'ember', label: 'Ember', src: `${base}/choice-ember.svg` },
  { key: 'moss', label: 'Moss', src: `${base}/choice-moss.svg` },
  { key: 'rose', label: 'Rose', src: `${base}/choice-rose.svg` },
  { key: 'dusk', label: 'Dusk', src: `${base}/choice-dusk.svg` },
]

export const presetSrc = (key: GroupAvatarKey | null): string | undefined =>
  GROUP_AVATAR_PRESETS.find((preset) => preset.key === key)?.src
