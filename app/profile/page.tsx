'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase/client'

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const init = async () => {
      setMsg('')

      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) return

      setEmail(user.email ?? '')

      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()

      setUsername(prof?.username ?? '')
    }

    init()
  }, [])

  // -------------------------
  // ユーザー名保存
  // -------------------------
  const saveUsername = async () => {
    setMsg('')
    const newName = username.trim()

    if (!newName) return setMsg('ユーザー名を入力してください')
    if (newName.length > 24) return setMsg('ユーザー名は24文字以内')

    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) return setMsg('ログインしてください')

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newName }),
      })

      const json = await res.json()
      if (!json.ok) return setMsg(json.error ?? '更新失敗')

      setMsg('ユーザー名を更新しました（過去投稿も反映）')
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  // パスワード変更
  // -------------------------
  const changePassword = async () => {
    setMsg('')

    if (!newPassword) return setMsg('新しいパスワードを入力してください')
    if (newPassword.length < 6)
      return setMsg('パスワードは6文字以上にしてください')

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) return setMsg(error.message)

      setNewPassword('')
      setMsg('パスワードを変更しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <p>
        <Link href="/">← 一覧に戻る</Link>
      </p>

      <h1>プロフィール</h1>

      {/* メール表示 */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 14, color: '#555' }}>メールアドレス</div>
        <div style={{ fontWeight: 700 }}>{email || '未ログイン'}</div>
      </div>

      {/* ユーザー名変更 */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, color: '#555' }}>ユーザー名</div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: '100%',
            padding: 10,
            border: '1px solid #ccc',
            borderRadius: 10,
            marginTop: 6,
          }}
        />
        <button
          onClick={saveUsername}
          disabled={loading}
          style={{
            marginTop: 10,
            padding: '10px 14px',
            borderRadius: 8,
            background: '#111',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {loading ? '保存中…' : 'ユーザー名を保存'}
        </button>
      </div>

      {/* パスワード変更 */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 14, color: '#555' }}>新しいパスワード</div>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="6文字以上"
          style={{
            width: '100%',
            padding: 10,
            border: '1px solid #ccc',
            borderRadius: 10,
            marginTop: 6,
          }}
        />

        <button
          onClick={changePassword}
          disabled={loading}
          style={{
            marginTop: 10,
            padding: '10px 14px',
            borderRadius: 8,
            background: '#0b6',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {loading ? '変更中…' : 'パスワードを変更'}
        </button>
      </div>

      {msg && (
        <p
          style={{
            marginTop: 16,
            color: msg.includes('失敗') || msg.includes('入力') ? '#b00020' : '#0b6',
          }}
        >
          {msg}
        </p>
      )}
    </div>
  )
}
