// app/profile/page.tsx
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('') // 任意
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')
  const [err, setErr] = useState<string>('')

  const canSave = useMemo(() => {
    return !loading && (username.trim().length > 0 || password.trim().length > 0)
  }, [loading, username, password])

  useEffect(() => {
    const init = async () => {
      setErr('')
      setMsg('')

      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user
      setEmail(user?.email ?? null)

      if (!user) return

      // profiles から username
      const { data: prof } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
      setUsername((prof?.username ?? '').trim())
    }
    init()
  }, [])

  const save = async () => {
    setErr('')
    setMsg('')

    const newUsername = username.trim()
    const newPassword = password.trim()

    if (!newUsername && !newPassword) {
      setErr('ユーザー名かパスワードのどちらかを入力してください')
      return
    }

    setLoading(true)
    try {
      // username 保存（サーバAPIで posts/room_members も更新）
      if (newUsername) {
        const { data: s } = await supabase.auth.getSession()
        const token = s.session?.access_token
        if (!token) {
          setErr('ログインしてください')
          return
        }

        const res = await fetch('/profile/set-username', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ username: newUsername }),
        })
        const json = await res.json()
        if (!json.ok) {
          setErr(json.error ?? 'ユーザー名の保存に失敗しました')
          return
        }
      }

      // password 変更（SupabaseはクライアントでOK）
      if (newPassword) {
        if (newPassword.length < 8) {
          setErr('パスワードは8文字以上にしてください')
          return
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) {
          setErr(error.message)
          return
        }
        setPassword('') // 入力欄クリア
      }

      setMsg('保存しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <p>
        <Link href="/">← トップに戻る</Link>
      </p>

      <h1 style={{ marginTop: 8 }}>プロフィール</h1>

      <div style={{ marginTop: 12, fontSize: 14, color: '#444' }}>
        <div>メールアドレス：<strong>{email ?? '未ログイン'}</strong></div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>ユーザー名（必須推奨）</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="例：toki"
          style={{
            width: '100%',
            border: '1px solid #ccc',
            borderRadius: 10,
            padding: '10px 12px',
          }}
        />
        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
          ここを設定すると、参加表示・投稿表示に反映されます（過去分も一括更新）。
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>ログインパスワード（変更したい時だけ）</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8文字以上"
          style={{
            width: '100%',
            border: '1px solid #ccc',
            borderRadius: 10,
            padding: '10px 12px',
          }}
        />
      </div>

      {err && <p style={{ color: '#b00020', marginTop: 12 }}>{err}</p>}
      {msg && <p style={{ color: '#0b6', marginTop: 12 }}>{msg}</p>}

      <button
        onClick={save}
        disabled={!canSave}
        style={{
          marginTop: 16,
          padding: '10px 14px',
          border: '1px solid #111',
          borderRadius: 10,
          cursor: canSave ? 'pointer' : 'not-allowed',
          background: '#111',
          color: '#fff',
          opacity: canSave ? 1 : 0.5,
        }}
      >
        {loading ? '保存中…' : '保存'}
      </button>
    </div>
  )
}
