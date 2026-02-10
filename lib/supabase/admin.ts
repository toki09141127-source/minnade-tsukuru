// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}

// ✅ 互換用（既存コードが import { supabaseAdmin } をしても落ちないように）
export const supabaseAdmin = createAdminClient()
