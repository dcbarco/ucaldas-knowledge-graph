import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

// Browser-side Supabase client — uses anon key, respects RLS
// Safe to call from 'use client' components
export function createClient() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Returns true when Supabase env vars are configured
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
