'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase/client'

export default function ProfilePage() {
  const [email, setEmail] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [newUsername, setNewUsername] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')

  useEffect(() => {
    const boot = async () => {
      const { data } = await supabase.auth.getUser()
      const u = data.user
      if (!u) return

      setEmail(u.email ?? '')
      setUserId(u.id)

      // まず profiles を正として読む（metadataより確実）
      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', u.id)
        .maybeSingle()

      const name = (prof?.username ?? '').trim()
      setUsername(name)
      setNewUsername(name)
    }
    boot()
  }, [])

  const canSaveName = useMemo(() => newUsername.trim().length > 0 && newUsername.trim().length <= 20 && !loading, [
    newUsername,
    loading,
  ])

  const saveUsername = async () => {
    setMsg('')
    const name = newUsername.trim()
    if (!name) return

    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setMsg('ログインしてください')
        return
      }

      const res = await fetch('/profile/set-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: name }),
      })

      const json = await res.json()
      if (!json.ok) {
        setMsg(json.error ?? '保存に失敗しました')
        return
      }

      setUsername(json.username)
      setMsg('ユーザー名を保存しました ✅')
    } finally {
      setLoading(false)
    }
  }

  const canSavePw = useMemo(() => newPassword.length >= 8 && !loading, [newPassword, loading])

  const changePassword = async () => {
    setMsg('')
    if (newPassword.length < 8) {
      setMsg('パスワードは8文字以上にしてください')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setMsg(error.message)
        return
      }
      setNewPassword('')
      setMsg('パスワードを変更しました ✅')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <p>
        <Link href="/">← トップへ</Link>
      </p>

      <h1 style={{ marginTop: 8 }}>プロフィール</h1>

      <div style={{ marginTop: 12, fontSize: 14, color: '#444' }}>
        <div><strong>UserID:</strong> {userId || '—'}</div>
        <div style={{ marginTop: 6 }}><strong>Email:</strong> {email || '—'}</div>
      </div>

      <hr style={{ margin: '18px 0' }} />

      <h2>ユーザー名</h2>
      <p style={{ color: '#666', fontSize: 13 }}>
        掲示板や参加者一覧に表示されます（最大20文字）
      </p>

      <input
        value={newUsername}
        onChange={(e) => setNewUsername(e.target.value)}
        placeholder="例：ねーそ"
        style={{
          width: '100%',
          border: '1px solid #ccc',
          borderRadius: 10,
          padding: '10px 12px',
        }}
      />

      <button
        onClick={saveUsername}
        disabled={!canSaveName}
        style={{
          marginTop: 12,
          padding: '10px 14px',
          border: '1px solid #111',
          borderRadius: 10,
          cursor: canSaveName ? 'pointer' : 'not-allowed',
          background: '#111',
          color: '#fff',
          opacity: canSaveName ? 1 : 0.5,
        }}
      >
        {loading ? '保存中…' : 'ユーザー名を保存'}
      </button>

      <div style={{ marginTop: 10, fontSize: 13, color: '#444' }}>
        現在の表示名：<strong>{username || '未設定'}</strong>
      </div>

      <hr style={{ margin: '18px 0' }} />

      <h2>パスワード変更</h2>
      <p style={{ color: '#666', fontSize: 13 }}>8文字以上</p>

      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="新しいパスワード"
        style={{
          width: '100%',
          border: '1px solid #ccc',
          borderRadius: 10,
          padding: '10px 12px',
        }}
      />

      <button
        onClick={changePassword}
        disabled={!canSavePw}
        style={{
          marginTop: 12,
          padding: '10px 14px',
          border: '1px solid #111',
          borderRadius: 10,
          cursor: canSavePw ? 'pointer' : 'not-allowed',
          background: '#111',
          color: '#fff',
          opacity: canSavePw ? 1 : 0.5,
        }}
      >
        {loading ? '変更中…' : 'パスワードを変更'}
      </button>

      {msg && <p style={{ marginTop: 12, color: msg.includes('✅') ? '#0b6' : '#b00020' }}>{msg}</p>}
    </div>
  )
}
