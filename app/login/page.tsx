'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  // ✅ 新規登録成功専用UI
  const [signupSuccess, setSignupSuccess] = useState(false)

  // ✅ 確認メール再送中
  const [resending, setResending] = useState(false)

  const signUp = async () => {
    setMessage('')
    setSignupSuccess(false)

    const e = email.trim()
    if (!e) {
      setMessage('メールアドレスを入力してください')
      return
    }
    if (password.length < 6) {
      setMessage('パスワードは6文字以上にしてください')
      return
    }

    const { error } = await supabase.auth.signUp({ email: e, password })
    if (error) {
      setMessage(error.message)
      return
    }

    // ✅ 成功：専用UIを表示（messageは通知専用にするのでここでは出さない）
    setSignupSuccess(true)
    setMessage('')
  }

  const resendConfirmation = async () => {
    setMessage('')

    const e = email.trim()
    if (!e) {
      setMessage('メールアドレスを入力してください（確認メール再送に必要です）')
      return
    }

    setResending(true)
    try {
      // ✅ 正式APIが存在する場合のみ使う（存在しないAPIは呼ばない）
      const authAny = supabase.auth as any

      if (typeof authAny?.resend === 'function') {
        const { error } = await authAny.resend({ type: 'signup', email: e })
        if (error) {
          setMessage(error.message)
          return
        }
        setMessage('確認メールを再送しました ✅（迷惑メールもご確認ください）')
        return
      }

      // resend が無い場合：SDK/型の都合（本番では明確に案内）
      setMessage(
        'この環境では確認メールの再送APIが利用できません（supabase-jsのバージョン確認・更新が必要です）'
      )
    } finally {
      setResending(false)
    }
  }

  const signIn = async () => {
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setMessage(error.message)
      return
    }
    router.replace('/')
    router.refresh()
  }

  const isSuccessMsg =
    message.includes('✅') || message.includes('再送しました') || message.includes('送信しました')

  return (
    <div style={{ padding: 24 }}>
      <h1>ログイン</h1>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: '1px solid #eee',
          borderRadius: 10,
          background: '#fafafa',
          maxWidth: 720,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>手順（メール＋パスワード方式）</div>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            <strong>初めての人</strong>は、メールとパスワードを入力して「<strong>新規登録</strong>」を押す
          </li>
          <li>
            新規登録後、確認メールが届いたら<strong>メール内リンクをクリックして有効化</strong>（必要な場合があります）
          </li>
          <li>
            <strong>有効化後</strong>にこの画面に戻り、「<strong>ログイン</strong>」を押す
          </li>
          <li>
            <strong>登録済みの人</strong>は、「ログイン」だけでOK
          </li>
          <li>
            パスワードは<strong>6文字以上推奨</strong>（短いと登録できないことがあります）
          </li>
          <li>
            うまくいかない時は、<strong>入力ミス</strong>（全角スペース/CapsLock/コピペ末尾の空白）をチェック
          </li>
        </ol>
        <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
          ※このサイトは<strong>マジックリンクではありません</strong>。メール＋パスワードでログインします。
          <br />
          ※Supabaseの設定で Confirm Email がONの場合、<strong>新規登録後にメール内リンククリックで有効化が必要</strong>なことがあります。
        </div>
      </div>

      {/* ✅ 入力欄：常に wrap 前提 + minWidth（縦積み固定はしない） */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (signupSuccess) setSignupSuccess(false)
          }}
          style={{
            border: '1px solid #ccc',
            padding: 8,
            minWidth: 220,
            flex: '1 1 220px',
          }}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (signupSuccess) setSignupSuccess(false)
          }}
          style={{
            border: '1px solid #ccc',
            padding: 8,
            minWidth: 220,
            flex: '1 1 220px',
          }}
        />
      </div>

      {/* ✅ ボタン：wrap 前提（狭ければ自然に2段へ） */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={signUp} style={{ minWidth: 120 }}>
          新規登録
        </button>
        <button onClick={signIn} style={{ minWidth: 120 }}>
          ログイン
        </button>
      </div>

      {/* ✅ 新規登録成功時の専用UI（messageとは別枠） */}
      {signupSuccess && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid #eee',
            borderRadius: 10,
            background: '#fafafa',
            maxWidth: 720,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>確認メールを送信しました</div>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            ・迷惑メールフォルダも確認してください
            <br />
            ・メール内リンクをクリックして<strong>有効化</strong>してください
            <br />
            ・有効化後にこの画面に戻り、<strong>ログイン</strong>してください
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={resendConfirmation} disabled={resending} style={{ minWidth: 160 }}>
              {resending ? '送信中…' : '確認メールを再送する'}
            </button>
          </div>

          <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
            ※確認メールが届くまで数分かかることがあります。届かない場合は、メールアドレスの入力ミスや末尾の空白も確認してください。
          </div>
        </div>
      )}

      {/* ✅ message表示（成功/失敗色） */}
      {message && (
        <p
          style={{
            marginTop: 12,
            padding: 10,
            border: '1px solid #ddd',
            borderRadius: 10,
            background: '#fff',
            color: isSuccessMsg ? '#0a7' : '#b00020',
            maxWidth: 720,
          }}
        >
          {message}
        </p>
      )}
    </div>
  )
}
