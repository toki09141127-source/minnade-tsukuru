import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client factory
 * - Client Component から毎回呼んでOK
 * - `supabase` (singleton) も互換用に export
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createBrowserClient(url, anon)
}

/**
 * Backward compatible singleton
 * （既存コードが `import { supabase } ...` してても壊れない）
 */
export const supabase = createClient()
