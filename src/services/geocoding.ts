// Location search via Nominatim (OpenStreetMap data).
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
//  - max 1 request per second  -> enforced below
//  - no search-as-you-type     -> callers must only search on submit
//  - identify the app          -> browsers send a Referer automatically;
//                                 optionally set VITE_NOMINATIM_EMAIL for contact
// For production traffic, move to a hosted geocoder or your own Nominatim.

export interface GeoResult {
  id: string
  name: string
  address: string
  category: string
  lat: number
  lng: number
  /** [[south, west], [north, east]] when the API provides a bounding box */
  bounds: [[number, number], [number, number]] | null
}

interface NominatimItem {
  place_id: number
  lat: string
  lon: string
  display_name: string
  name?: string
  type?: string
  addresstype?: string
  boundingbox?: [string, string, string, string] // south, north, west, east
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const MIN_INTERVAL_MS = 1100
const contactEmail = (import.meta.env.VITE_NOMINATIM_EMAIL as string | undefined)?.trim()

let nextSlotAt = 0
const cache = new Map<string, GeoResult[]>()

const abortError = () => new DOMException('Aborted', 'AbortError')

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError())
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function humanize(raw?: string): string {
  if (!raw) return 'Place'
  const s = raw.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function toResult(item: NominatimItem): GeoResult | null {
  const lat = Number.parseFloat(item.lat)
  const lng = Number.parseFloat(item.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const parts = item.display_name.split(',').map((p) => p.trim())
  const name = item.name || parts[0]
  const address = (parts[0] === name ? parts.slice(1) : parts).join(', ')

  let bounds: GeoResult['bounds'] = null
  if (item.boundingbox && item.boundingbox.length === 4) {
    const [s, n, w, e] = item.boundingbox.map(Number.parseFloat)
    if ([s, n, w, e].every(Number.isFinite)) {
      bounds = [
        [s, w],
        [n, e],
      ]
    }
  }

  return {
    id: String(item.place_id),
    name,
    address,
    category: humanize(item.addresstype || item.type),
    lat,
    lng,
    bounds,
  }
}

export async function searchPlaces(
  query: string,
  opts: { signal: AbortSignal; viewbox?: [number, number, number, number] }, // west, north, east, south
): Promise<GeoResult[]> {
  const key = query.trim().toLowerCase().replace(/\s+/g, ' ')
  const cached = cache.get(key)
  if (cached) return cached

  // Reserve the next free slot so rapid calls queue instead of bursting
  const delay = Math.max(0, nextSlotAt - Date.now())
  nextSlotAt = Date.now() + delay + MIN_INTERVAL_MS
  if (delay > 0) await wait(delay, opts.signal)

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'jsonv2',
    limit: '6',
    dedupe: '1',
    'accept-language': navigator.language || 'en',
  })
  if (opts.viewbox) params.set('viewbox', opts.viewbox.join(',')) // soft bias, not bounded
  if (contactEmail) params.set('email', contactEmail)

  let res: Response
  try {
    res = await fetch(`${ENDPOINT}?${params}`, {
      signal: opts.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new Error('Could not reach the search service. Check your connection.')
  }

  if (res.status === 429) throw new Error('Too many searches in a short time. Wait a moment and try again.')
  if (!res.ok) throw new Error('The search service had a problem. Try again shortly.')

  const data = (await res.json()) as NominatimItem[]
  const results = data.map(toResult).filter((r): r is GeoResult => r !== null)
  cache.set(key, results)
  return results
}
