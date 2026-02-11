'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  // ✅ 追加：新規登録成功専用UIの表示状態
  const [signupSuccess, setSignupSuccess] = useState(false)

  // ✅ 追加：再送中フラグ
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

    // ✅ signUp成功時：既存messageとは別に専用UIを表示
    setSignupSuccess(true)
    setMessage('') // 既存message領域は空でもOK（成功UIは別ボックスで表示）
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
      const authAny: any = supabase.auth

      // ✅ supabase-js v2 系：auth.resend({ type: 'signup', email })
      if (typeof authAny?.resend === 'function') {
        const { error } = await authAny.resend({ type: 'signup', email: e })
        if (error) {
          setMessage(error.message)
          return
        }
        setMessage('確認メールを再送しました ✅（迷惑メールもご確認ください）')
        return
      }

      // ✅ supabase-js v1 系：auth.api.resendConfirmationEmail(email)
      if (typeof authAny?.api?.resendConfirmationEmail === 'function') {
        const { error } = await authAny.api.resendConfirmationEmail(e)
        if (error) {
          setMessage(error.message)
          return
        }
        setMessage('確認メールを再送しました ✅（迷惑メールもご確認ください）')
        return
      }

      // ✅ どちらも無い場合：SDK仕様の可能性
      setMessage('確認メールの再送に対応していないSDKです。supabase-jsの更新を確認してください。')
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
    message.includes('登録しました') ||
    message.includes('✅') ||
    message.includes('再送しました') ||
    message.includes('送信しました')

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
            画面に「登録しました」と出たら、同じメール/パスワードで「<strong>ログイン</strong>」を押す
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
          ※ただし設定によっては<strong>新規登録後に確認メールのリンクをクリックして有効化が必要</strong>な場合があります。
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            // 入力が変わったら「成功状態」を解除（最小）
            setSignupSuccess(false)
          }}
          style={{ border: '1px solid #ccc', padding: 8 }}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setSignupSuccess(false)
          }}
          style={{ border: '1px solid #ccc', padding: 8 }}
        />
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={signUp}>新規登録</button>
        <button onClick={signIn}>ログイン</button>
      </div>

      {/* ✅ 新規登録成功時の専用メッセージUI（signupSuccess のときだけ表示） */}
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
            ・メール内のリンクをクリックして<strong>有効化</strong>してください
            <br />
            ・有効化後にこの画面に戻り、<strong>ログイン</strong>してください
          </div>

          <div style={{ marginTop: 10 }}>
            <button onClick={resendConfirmation} disabled={resending}>
              {resending ? '送信中…' : '確認メールを再送する'}
            </button>
          </div>

          <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
            ※確認メールが届くまで数分かかることがあります。届かない場合は、メールアドレスの入力ミスや末尾の空白も確認してください。
          </div>
        </div>
      )}

      {/* ✅ 既存message表示（成功/失敗の色ルールを踏襲して少し拡張） */}
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
