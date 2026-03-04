'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      // URLに含まれる code / token を Supabase が処理してセッション化する
      // （supabase-js v2 では必要になるケースが多い）
      await supabase.auth.getSession()

      // ここは好みで。ログイン後の戻り先
      router.replace('/')
      router.refresh()
    }
    run()
  }, [router])

  return (
    <div style={{ padding: 24 }}>
      <h1>認証処理中…</h1>
      <p style={{ color: '#666' }}>しばらくお待ちください。</p>
    </div>
  )
}