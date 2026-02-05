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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

      <p style={{ marginTop: 12 }}>{message}</p>
    </div>
  )
}
