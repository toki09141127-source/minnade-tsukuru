'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { emailConfirmationTarget, type EmailConfirmation } from '@/lib/emailConfirmation'

export default function ConfirmEmailPage() {
  const target = useRef<EmailConfirmation | null>(null)
  const [kind, setKind] = useState<EmailConfirmation['kind'] | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'opening'>('loading')
  useEffect(() => {
    // Keep the validated target in memory only. The ref also survives React's
    // development effect replay after the fragment has been removed.
    if (!target.current) target.current = emailConfirmationTarget(window.location.href, process.env.NEXT_PUBLIC_SUPABASE_URL)
    window.history.replaceState(null, '', '/auth/confirm')
    setKind(target.current?.kind ?? null)
    setState(target.current ? 'ready' : 'invalid')
  }, [])
  const continueRecovery = () => {
    if (state !== 'ready' || !target.current) return
    const destination = target.current.url
    target.current = null
    setState('opening')
    window.location.replace(destination)
  }
  const signup = kind === 'signup'
  return <section style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <h1>{signup ? 'メールアドレスを確認する' : kind === 'recovery' ? 'パスワードの再設定を続ける' : 'メールの確認'}</h1>
    {state === 'invalid' ? <div role="alert">
      <p>メールのリンクを確認できませんでした。最新メールのリンクを、登録・再設定を始めたブラウザで開いてください。</p>
      <p>確認コード：AUTH-10</p>
      <p>繰り返し失敗する場合は再送せず、この確認コードだけをお問い合わせください。</p>
    </div> : <>
      <p>{signup ? 'ご自身で新規登録を申し込んだ場合は、下のボタンを押してください。' : 'ご自身でパスワード再設定を申し込んだ場合は、下のボタンを押してください。'}</p>
      <p>登録・再設定を始めた端末の同じブラウザで操作してください。</p>
      <p>{signup ? 'この画面を開いただけでは、メール確認は完了しません。' : 'この画面を開いただけでは、パスワードは変わりません。'}</p>
      <button type="button" disabled={state !== 'ready'} onClick={continueRecovery} style={{ minHeight: 44, padding: '12px 24px' }}>
        {state === 'opening' ? '確認中…' : state === 'loading' ? '読み込み中…' : signup ? 'メールアドレスを確認する' : '再設定を続ける'}
      </button>
    </>}
    <p><Link href="/login">ログイン画面へ戻る</Link></p>
  </section>
}
