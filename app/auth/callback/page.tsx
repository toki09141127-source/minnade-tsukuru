'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { callbackDestination } from '@/lib/authFlow'
import { callbackLinkStatus, callbackMessages, callbackStatus, type CallbackStage, type CallbackStatus } from '@/lib/authCallbackStatus'
export default function AuthCallbackPage() {
  const router = useRouter()
  const [failure, setFailure] = useState<CallbackStatus | null>(null)
  useEffect(() => {
    let active = true
    const run = async () => {
      let stage: CallbackStage = 'link'
      try {
        const destination = callbackDestination(window.location.href)
        if (!destination) throw new Error('CALLBACK_FAILED')
        // createBrowserClient initializes the PKCE exchange. Await it once; do not exchange the same code twice.
        stage = 'initialize'
        const initialized = await supabase.auth.initialize()
        if (initialized.error) throw initialized.error
        stage = 'session'
        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) throw error || new Error('CALLBACK_FAILED')
        stage = 'user'
        const verified = await supabase.auth.getUser()
        if (verified.error || !verified.data.user) throw verified.error || new Error('CALLBACK_FAILED')
        if (active) { router.replace(destination); router.refresh() }
      } catch (error) {
        if (active) {
          const status = stage === 'link' ? callbackLinkStatus(window.location.href) : callbackStatus(stage, error, new URL(window.location.href).searchParams.has('code'))
          window.history.replaceState(null, '', '/auth/callback')
          setFailure(status)
        }
      }
    }
    void run()
    return () => { active = false }
  }, [router])
  return <section style={{padding:24}}>
    <h1>{failure ? '認証リンクを確認できませんでした' : '認証処理中…'}</h1>
    {failure ? <div role="alert">
      <p>{callbackMessages[failure].text}</p>
      <p>確認コード：{callbackMessages[failure].code}</p>
      <p>登録・再設定を始めた端末・ブラウザで、最新メールのリンクを開いてください。繰り返し失敗する場合はメールを連続で再送せず、この確認コードだけをお問い合わせください。パスワードやメールのリンクは送らないでください。</p>
      <p><Link href="/login">ログイン画面へ戻る</Link></p>
    </div> : <p>しばらくお待ちください。</p>}
  </section>
}
