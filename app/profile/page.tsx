'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase/client'

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('') // 空なら変更しない
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')

  useEffect(() => {
    const init = async () => {
      const { data: u } = await supabase.auth.getUser()
      setEmail(u.user?.email ?? null)

      if (u.user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', u.user.id)
          .maybeSingle()

        setUsername((prof?.username ?? '').toString())
      }
    }
    init()
  }, [])

  const canSave = useMemo(() => {
    if (loading) return false
    const nameOk = username.trim().length >= 2 && username.trim().length <= 20
    const passOk = password === '' || password.length >= 6
    return nameOk && passOk
  }, [username, password, loading])

  const save = async () => {
    setMsg('')
    const name = username.trim()

    if (name.length < 2 || name.length > 20) {
      setMsg('ユーザー名は 2〜20文字 にしてください')
      return
    }
    if (password !== '' && password.length < 6) {
      setMsg('パスワードは 6文字以上 にしてください（変更しないなら空でOK）')
      return
    }

    setLoading(true)
    try {
      // ログイン必須
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setMsg('ログインしてください')
        return
      }

      // ① ユーザー名更新（サーバー側で profiles / posts / room_members も更新）
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
        setMsg(json.error ?? 'ユーザー名の保存に失敗しました')
        return
      }

      // ② パスワード変更（空ならスキップ）
      if (password !== '') {
        const { error: pwErr } = await supabase.auth.updateUser({ password })
        if (pwErr) {
          setMsg(`ユーザー名は保存できましたが、パスワード変更に失敗: ${pwErr.message}`)
          return
        }
        setPassword('')
      }

      setMsg('保存しました ✅')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <p>
        <Link href="/">← トップへ</Link> / <Link href="/rooms">ルーム一覧</Link>
      </p>

      <h1 style={{ marginTop: 8 }}>プロフィール</h1>

      {!email ? (
        <p style={{ color: '#b00020', marginTop: 12 }}>
          ログインしてください（/login）
        </p>
      ) : (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, color: '#666' }}>メールアドレス</div>
            <div style={{ marginTop: 4, fontSize: 16 }}>
              <strong>{email}</strong>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              ユーザー名（2〜20文字）
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例：ねーそ"
              style={{
                width: '100%',
                border: '1px solid #ccc',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
              未設定だと投稿/参加で弾かれることがあります（事故防止）
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              パスワード変更（変更しないなら空でOK）
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              type="password"
              style={{
                width: '100%',
                border: '1px solid #ccc',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            />
          </div>

          {msg && (
            <p style={{ marginTop: 12, color: msg.includes('失敗') ? '#b00020' : '#0a7' }}>
              {msg}
            </p>
          )}

          <button
            type="button"
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
        </>
      )}
    </div>
  )
}
