'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  // すでにログイン済みなら / に飛ばす
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) router.replace('/')
    }
    check()
  }, [router])

  const signUp = async () => {
    setMessage('')
    const { error } = await supabase.auth.signUp({ email, password })
    setMessage(error ? error.message : '登録しました。次に「ログイン」を押してください。')
  }

  const signIn = async () => {
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(error.message)
      return
    }
    // ログイン成功 → / へ
    router.replace('/')
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>ログイン</h1>

      {/* ✅ 手順と注意点（最小追加） */}
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
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ border: '1px solid #ccc', padding: 8 }}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ border: '1px solid #ccc', padding: 8 }}
        />
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={signUp}>新規登録</button>
        <button onClick={signIn}>ログイン</button>
      </div>

      {/* ✅ messageを少し目立たせる（最小変更） */}
      {message && (
        <p
          style={{
            marginTop: 12,
            padding: 10,
            border: '1px solid #ddd',
            borderRadius: 10,
            background: '#fff',
            color: message.includes('登録しました') ? '#0a7' : '#b00020',
            maxWidth: 720,
          }}
        >
          {message}
        </p>
      )}
    </div>
  )
}
