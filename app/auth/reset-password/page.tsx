'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { passwordError } from '@/lib/authFlow'
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    void supabase.auth.getUser().then(({data,error}) => {
      if (!active) return
      setReady(!error && !!data.user)
      if (error || !data.user) setMessage('再設定メールのリンクから開いてください。期限切れの場合はメールを再送してください。')
    }).catch(() => { if (active) setMessage('認証状態を確認できませんでした。時間をおいて再度お試しください。') })
    return () => { active = false }
  }, [])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!ready || busy || done) return
    const validation = passwordError(password, confirmation)
    if (validation) { setMessage(validation); return }
    setBusy(true); setMessage('')
    try {
      const verified = await supabase.auth.getUser()
      if (verified.error || !verified.data.user) { setReady(false); setMessage('認証の有効期限が切れました。再設定メールを再送してください。'); return }
      const {error} = await supabase.auth.updateUser({password})
      if (error) { setMessage('変更できませんでした。以前と異なる十分に長いパスワードをお試しください。'); return }
      setPassword(''); setConfirmation(''); setDone(true); setReady(false)
      const logout = await supabase.auth.signOut({scope:'local'})
      setMessage(logout.error ? 'パスワードは変更済みです。ログアウト後、新しいパスワードでログインしてください。' : 'パスワードを変更しました。新しいパスワードでログインしてください。')
    } catch { setMessage('通信を確認できませんでした。変更の成否が不明な場合は、新しいパスワードでログインを試してください。') }
    finally { setBusy(false) }
  }
  return <section style={{maxWidth:640,margin:'0 auto',padding:24}}>
    <h1>パスワードを再設定</h1><p>新しいパスワードを8文字以上で設定してください。</p>
    <form onSubmit={submit} style={{display:'grid',gap:16}}>
      <label>新しいパスワード<input type="password" autoComplete="new-password" minLength={8} required value={password} disabled={!ready || busy} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:12}} /></label>
      <label>新しいパスワード（確認）<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} disabled={!ready || busy} onChange={e=>setConfirmation(e.target.value)} style={{display:'block',width:'100%',padding:12}} /></label>
      <button disabled={!ready || busy || done} style={{minHeight:44}}>{busy ? '変更中…' : 'パスワードを変更'}</button>
    </form>
    {message && <p role="status">{message}</p>}<p><Link href="/login">ログイン画面へ</Link></p>
  </section>
}
