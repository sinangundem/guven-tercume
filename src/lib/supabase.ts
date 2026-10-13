import { createClient } from '@supabase/supabase-js'

// Vercel'e /rest/v1 gibi yol veya sondaki / ile yapıştırılsa da yalnızca adres kökü kullanılır.
function normalizeUrl(value: string | undefined) {
  try {
    return value ? new URL(value.trim()).origin : undefined
  } catch {
    return undefined
  }
}

const url = normalizeUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
