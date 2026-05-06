import { createClient } from '@supabase/supabase-js'

// Server-side client with SERVICE ROLE key — bypasses RLS entirely.
// Use ONLY in API routes and server actions. Never expose to the browser.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Server-side client with ANON key — respects RLS (read-only for public data).
// Use when you only need public reads and want RLS enforcement.
export function createAnonServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
