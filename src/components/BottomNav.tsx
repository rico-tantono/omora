import { Bell, Map as MapIcon, User, Users } from 'lucide-react'
import type { TabId } from '../types'

interface Props {
  active: TabId
  onChange: (tab: TabId) => void
  unreadCount: number
}

const items = [
  { id: 'map', label: 'My Map', Icon: MapIcon },
  { id: 'connections', label: 'Connections', Icon: Users },
  { id: 'updates', label: 'Updates', Icon: Bell },
  { id: 'me', label: 'Me', Icon: User },
] as const

// Icons only. The active one fills in, lifts slightly and gets a dot below it.
// Labels stay available to screen readers through aria-label.
export default function BottomNav({ active, onChange, unreadCount }: Props) {
  return (
    <nav aria-label="Main" className="pb-safe z-[1300] shrink-0 border-t border-ink/10 bg-paper">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {items.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative grid h-14 w-full place-items-center transition-colors duration-[350ms] ${
                  isActive ? 'text-ember-700' : 'text-ink-soft'
                }`}
              >
                <span
                  className={`relative transition-transform duration-[550ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] ${
                    isActive ? '-translate-y-1' : 'translate-y-0'
                  }`}
                >
                  <Icon size={24} strokeWidth={isActive ? 2 : 1.7} fill={isActive ? 'currentColor' : 'none'} />
                  {id === 'updates' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-ember-700 px-1 text-[10px] font-bold text-white ring-2 ring-paper">
                      {unreadCount}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute bottom-1.5 h-1 w-1 rounded-full bg-ember-700 transition-all duration-[550ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] ${
                    isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                  }`}
                />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
