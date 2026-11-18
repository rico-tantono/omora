import { Globe, Lock, Users } from 'lucide-react'
import type { Visibility } from '../types'

type Meta = { label: string; hint: string; Icon: typeof Globe }

// Who can see a memory. Memories are only ever "private" or "connections".
export const visibilityMeta: Record<Visibility, Meta> = {
  public: { label: 'Public', hint: 'Anyone can see this', Icon: Globe },
  connections: { label: 'Connections', hint: 'Only people you are connected with', Icon: Users },
  private: { label: 'Private', hint: 'Only you', Icon: Lock },
}

// Who can find your profile in search.
export const profileVisibilityMeta: Record<Visibility, Meta> = {
  public: { label: 'Public', hint: 'Anyone can find you by name or username', Icon: Globe },
  connections: { label: 'Connections only', hint: 'Only people who type your exact username can find you', Icon: Users },
  private: { label: 'Private', hint: 'Nobody can find you. You reach out to people yourself', Icon: Lock },
}

export const visibilityOrder: Visibility[] = ['public', 'connections', 'private']
