import { useEffect, useRef, type FormEvent } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import type { GeoResult } from '../services/geocoding'
import type { Memory } from '../types'
import { MIN_QUERY_LENGTH, type SearchStatus } from '../hooks/usePlaceSearch'
import { usePresence } from '../lib/usePresence'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (q: string) => void
  onSubmit: () => void
  onClear: () => void
  status: SearchStatus
  submitted: string
  errorMessage: string
  places: GeoResult[]
  memoryMatches: Memory[]
  onSelectPlace: (p: GeoResult) => void
  onSelectMemory: (m: Memory) => void
}

export default function SearchBar(props: Props) {
  const { open, onOpenChange, query, onQueryChange, onSubmit, onClear } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const { mounted, visible } = usePresence(open)

  // Closing the panel (map tap, Cancel, picking a result) also drops the keyboard
  useEffect(() => {
    if (!open) inputRef.current?.blur()
  }, [open])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-[1200] px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <form role="search" onSubmit={handleSubmit} className="pointer-events-auto">
        <div
          className={`flex h-12 items-center rounded-xl border bg-card shadow-float transition-colors duration-[350ms] ${
            open ? 'border-ember-500' : 'border-ink/10'
          }`}
        >
          <button type="submit" aria-label="Search places" className="grid h-12 w-12 shrink-0 place-items-center text-ink">
            <Search size={20} strokeWidth={1.8} />
          </button>
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => onOpenChange(true)}
            placeholder="Search places and memories"
            aria-label="Search places and memories"
            aria-expanded={open}
            aria-controls="search-panel"
            className="h-full min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-soft/70 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                onClear()
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="grid h-12 w-10 shrink-0 place-items-center text-ink-soft"
            >
              <X size={18} />
            </button>
          )}
          {open && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-12 shrink-0 pr-4 pl-1 text-sm font-semibold text-ember-700"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {mounted && (
        <div
          id="search-panel"
          className={`pointer-events-auto mt-2 max-h-[min(62dvh,30rem)] overflow-y-auto overscroll-contain rounded-xl bg-card shadow-float transition duration-[350ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] ${
            visible ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0'
          }`}
        >
          <PanelBody {...props} />
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="px-4 pt-4 pb-1 text-xs font-semibold text-ink-soft">{children}</h2>
}

function PanelBody({
  query,
  onSubmit,
  status,
  submitted,
  errorMessage,
  places,
  memoryMatches,
  onSelectPlace,
  onSelectMemory,
}: Props) {
  const trimmed = query.trim()
  const fresh = submitted !== '' && submitted === trimmed

  return (
    <div className="pb-2">
      {trimmed === '' && (
        <p className="px-4 py-4 text-sm leading-relaxed text-ink-soft">
          Search for a place, address or landmark. Press search on your keyboard to look it up.
        </p>
      )}

      {memoryMatches.length > 0 && (
        <section>
          <SectionTitle>My memories</SectionTitle>
          <ul>
            {memoryMatches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelectMemory(m)}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left active:bg-sand"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ember-500" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.title}</span>
                    <span className="block truncate text-sm text-ink-soft">{m.placeName}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trimmed !== '' && (
        <section aria-live="polite">
          <SectionTitle>Places</SectionTitle>

          {fresh && status === 'loading' && (
            <ul aria-label="Searching" className="px-4 pb-1">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex h-14 animate-pulse flex-col justify-center gap-2">
                  <span className="h-3 w-2/3 rounded bg-sand" />
                  <span className="h-3 w-1/2 rounded bg-sand" />
                </li>
              ))}
            </ul>
          )}

          {fresh && status === 'error' && (
            <div className="px-4 pt-1 pb-3">
              <p className="text-sm text-ink">{errorMessage}</p>
              <button type="button" onClick={onSubmit} className="mt-2 h-10 rounded-lg bg-sand px-4 text-sm font-semibold text-ember-900">
                Try again
              </button>
            </div>
          )}

          {fresh && status === 'empty' && (
            <p className="px-4 pt-1 pb-3 text-sm leading-relaxed text-ink-soft">
              Nothing found for “{submitted}”. Try the full name, or add a city.
            </p>
          )}

          {fresh && status === 'success' && (
            <>
              <ul>
                {places.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onSelectPlace(p)}
                      className="flex min-h-[56px] w-full items-start gap-3 px-4 py-2.5 text-left active:bg-sand"
                    >
                      <MapPin size={18} className="mt-0.5 shrink-0 text-ember-500" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="shrink-0 text-xs text-ink-soft">{p.category}</span>
                        </span>
                        <span className="line-clamp-2 text-sm text-ink-soft">{p.address}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="px-4 pt-1 pb-2 text-[11px] text-ink-soft">Results from OpenStreetMap Nominatim</p>
            </>
          )}

          {!fresh &&
            (trimmed.length < MIN_QUERY_LENGTH ? (
              <p className="px-4 pt-1 pb-3 text-sm text-ink-soft">Type at least {MIN_QUERY_LENGTH} characters to search places.</p>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left active:bg-sand"
              >
                <Search size={18} className="shrink-0 text-ember-500" />
                <span className="min-w-0 truncate">
                  Search places for <span className="font-semibold">“{trimmed}”</span>
                </span>
              </button>
            ))}
        </section>
      )}

    </div>
  )
}
