'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { callbackDestination } from '@/lib/authFlow'
export default function AuthCallbackPage() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const destination = callbackDestination(window.location.href)
        if (!destination) throw new Error('CALLBACK_FAILED')
        // createBrowserClient initializes the PKCE exchange. Await it once; do not exchange the same code twice.
        const initialized = await supabase.auth.initialize()
        if (initialized.error) throw new Error('CALLBACK_FAILED')
        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) throw new Error('CALLBACK_FAILED')
        const verified = await supabase.auth.getUser()
        if (verified.error || !verified.data.user) throw new Error('CALLBACK_FAILED')
        if (active) { router.replace(destination); router.refresh() }
      } catch {
        if (active) { window.history.replaceState(null, '', '/auth/callback'); setFailed(true) }
      }
    }
    void run()
    return () => { active = false }
  }, [router])
  return <section style={{padding:24}}>
    <h1>{failed ? '認証リンクを確認できませんでした' : '認証処理中…'}</h1>
    {failed ? <p role="alert">リンクの期限切れ、または別のブラウザで開いた可能性があります。登録・再設定を始めたブラウザで開くか、<Link href="/login">ログイン画面</Link>からメールを再送してください。</p> : <p>しばらくお待ちください。</p>}
  </section>
}
