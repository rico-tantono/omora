import { useCallback, useEffect, useRef, useState } from 'react'
import { searchPlaces, type GeoResult } from '../services/geocoding'

export type SearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

interface SearchState {
  status: SearchStatus
  places: GeoResult[]
  submitted: string // the query these results belong to
  error: string
}

const initial: SearchState = { status: 'idle', places: [], submitted: '', error: '' }
export const MIN_QUERY_LENGTH = 3

// Search runs only when submit() is called (never per keystroke), cancels any
// request still in flight, and ignores duplicate submits of the same query.
export function usePlaceSearch() {
  const [query, setQueryState] = useState('')
  const [state, setState] = useState<SearchState>(initial)
  const abortRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef('')

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    inFlightRef.current = ''
  }, [])

  useEffect(() => cancel, [cancel])

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q)
      if (!q.trim()) {
        cancel()
        setState(initial)
      }
    },
    [cancel],
  )

  const reset = useCallback(() => {
    cancel()
    setQueryState('')
    setState(initial)
  }, [cancel])

  const submit = useCallback(
    async (viewbox?: [number, number, number, number]) => {
      const q = query.trim()
      if (q.length < MIN_QUERY_LENGTH) return
      const key = q.toLowerCase()
      if (inFlightRef.current === key) return

      cancel()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      inFlightRef.current = key
      setState({ status: 'loading', places: [], submitted: q, error: '' })

      try {
        const places = await searchPlaces(q, { signal: ctrl.signal, viewbox })
        if (ctrl.signal.aborted) return
        setState({ status: places.length ? 'success' : 'empty', places, submitted: q, error: '' })
      } catch (err) {
        if (ctrl.signal.aborted || (err as Error).name === 'AbortError') return
        setState({ status: 'error', places: [], submitted: q, error: (err as Error).message })
      } finally {
        if (abortRef.current === ctrl) {
          abortRef.current = null
          inFlightRef.current = ''
        }
      }
    },
    [query, cancel],
  )

  return { query, setQuery, submit, reset, ...state }
}
