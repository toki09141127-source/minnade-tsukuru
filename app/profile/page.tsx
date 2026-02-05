'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase/client'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    const init = async () => {
      setError('')
      setOk('')
      setLoading(true)

      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) {
        setLoading(false)
        setError('ログインしてください')
        return
      }

      // 1) user_metadata の username
      const metaName = String((user.user_metadata as any)?.username ?? '').trim()

      // 2) profiles の username
      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()

      const profName = String(prof?.username ?? '').trim()

      setUsername(profName || metaName || '')
      setLoading(false)
    }

    init()
  }, [])

  const save = async () => {
    setError('')
    setOk('')

    const name = username.trim()
    if (!name) return setError('ユーザー名を入力してください（空は不可）')
    if (name.length > 20) return setError('ユーザー名は20文字以内にしてください')

    setSaving(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) return setError('ログインしてください')

      // A) profiles に upsert
      const { error: upErr } = await supabase.from('profiles').upsert({
        id: user.id,
        username: name,
      })
      if (upErr) return setError(upErr.message)

      // B) auth の user_metadata にも保存（表示が安定する）
      const { error: metaErr } = await supabase.auth.updateUser({
        data: { username: name },
      })
      if (metaErr) return setError(metaErr.message)

      setOk('保存しました！')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <Link href="/rooms">← ルーム一覧へ</Link>

      <h1 style={{ marginTop: 10 }}>ユーザー名の設定</h1>

      <div
        style={{
          marginTop: 12,
          padding: 14,
          background: '#eef3ff',
          borderRadius: 10,
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        <strong>なぜ必要？</strong>
        <br />
        掲示板に「名無し」が増えるのを防ぐため、最初にユーザー名を決めます。
        <br />
        いつでも変更できます（20文字まで）。
      </div>

      {loading ? (
        <p style={{ marginTop: 14 }}>読み込み中…</p>
      ) : (
        <>
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#555' }}>
              ユーザー名
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例）トキ / ねーそ / 編集長 など"
              style={{
                width: '100%',
                border: '1px solid #ccc',
                borderRadius: 10,
                padding: 10,
                marginTop: 6,
              }}
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            style={{
              marginTop: 12,
              padding: '10px 14px',
              border: '1px solid #111',
              borderRadius: 10,
              cursor: 'pointer',
              background: '#111',
              color: '#fff',
            }}
          >
            {saving ? '保存中…' : '保存する'}
          </button>

          {error && <p style={{ color: '#b00020', marginTop: 10 }}>{error}</p>}
          {ok && <p style={{ color: '#0b6', marginTop: 10 }}>{ok}</p>}
        </>
      )}
    </div>
  )
}
