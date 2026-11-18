import type { Memory } from '../types'

// Memories whose visit date falls on today's month and day in an earlier year.
// Nothing matches on most days; the Me page only shows the card when something does.
export function memoriesOnThisDay(memories: Memory[], today = new Date()): Memory[] {
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return memories
    .filter((m) => {
      const [y, mo, d] = m.visitDate.split('-')
      return mo === mm && d === dd && Number(y) < today.getFullYear()
    })
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
}

export function yearsAgo(iso: string, today = new Date()): number {
  return today.getFullYear() - Number(iso.split('-')[0])
}
