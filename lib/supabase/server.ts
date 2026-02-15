// lib/supabase/server.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Cookie からセッションを読み取る Supabase クライアント（RLSで auth.uid() が効く）
 * Next の型定義によって cookies() が Promise 扱いになる場合があるため async + await で統一。
 */
export async function createUserClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        // 今回は読み取りだけでOK。必要になったら実装する
        set() {},
        remove() {},
      },
    }
  )
}

/**
 * Service Role（絶対にクライアントへ渡さない）
 * 承認/却下/取り消しなど「DBを確実に書き換える」用途
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
