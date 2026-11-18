import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabaseUrl = url

export const missingSupabaseEnv = [
  url ? null : 'VITE_SUPABASE_URL',
  publishableKey ? null : 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter((name): name is string => name !== null)

let client: SupabaseClient | undefined

// The app shares one client, created on first use. Only the publishable key ever reaches the browser.
export function getSupabase(): SupabaseClient {
  if (!url || !publishableKey) {
    throw new Error(
      `Missing environment variables: ${missingSupabaseEnv.join(', ')}. Add them to .env.local and restart the dev server.`,
    )
  }
  client ??= createClient(url, publishableKey)
  return client
}
