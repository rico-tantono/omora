// Stands in for src/lib/supabase.ts. Each test installs the fake client it needs.
export const fake: { client: any } = { client: null }
export const supabaseUrl = 'https://project.supabase.co'
export const missingSupabaseEnv: string[] = []
export const getSupabase = () => fake.client
