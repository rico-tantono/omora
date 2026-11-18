// "Nadia Rahman" -> "NR", "kenji.sketch" -> "K"
export function initialsOf(name: string, max = 1): string {
  const words = name.trim().split(/[\s._-]+/).filter(Boolean)
  const letters = words.slice(0, max).map((w) => w.charAt(0).toUpperCase())
  return letters.join('') || '?'
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name
