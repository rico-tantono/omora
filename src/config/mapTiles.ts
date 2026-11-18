// CARTO Positron ("light_all"): a calm, light-gray basemap.
// The key lives in .env.local as VITE_CARTO_API_KEY (never hardcode it here).
const apiKey = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim()

const BASE_URL = 'https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png'

if (!apiKey) {
  console.warn(
    '[Social Memory Map] VITE_CARTO_API_KEY is missing. Add it to .env.local and restart `npm run dev`. ' +
      'Using CARTO tiles without a key for now.',
  )
}

export const TILE_URL = apiKey ? `${BASE_URL}?key=${apiKey}` : BASE_URL

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>'
