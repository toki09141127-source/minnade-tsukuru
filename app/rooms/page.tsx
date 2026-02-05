'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase/client'

export default function NewRoomPage() {
  const [title, setTitle] = useState('')
  const [workType, setWorkType] = useState('novel')
  const [hours, setHours] = useState(50)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  const create = async () => {
    setError('')
    setOk('')
    if (!title.trim()) return setError('タイトルを入力してください')

    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) return setError('ログインしてください')

      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          workType,
          timeLimitHours: hours,
        }),
      })

      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? '作成失敗')
        return
      }

      setOk('作成しました。ルームへ移動します…')
      location.href = `/rooms/${json.roomId}`
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Link href="/rooms">← 一覧に戻る</Link>

      <h1 style={{ marginTop: 10 }}>ルームを作成</h1>

      <div style={{ marginTop: 12, display: 'grid', gap: 10, maxWidth: 520 }}>
        <label>
          タイトル
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 10 }}
          />
        </label>

        <label>
          種別（work_type）
          <input
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 10 }}
          />
        </label>

        <label>
          制限時間（hours）
          <input
            type="number"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            min={1}
            style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 10 }}
          />
        </label>

        <button
          onClick={create}
          disabled={loading}
          style={{
            padding: '10px 14px',
            border: '1px solid #111',
            borderRadius: 8,
            cursor: 'pointer',
            background: '#111',
            color: '#fff',
          }}
        >
          {loading ? '作成中…' : '作成'}
        </button>

        {error && <p style={{ color: '#b00020' }}>{error}</p>}
        {ok && <p style={{ color: '#0b6' }}>{ok}</p>}
      </div>
    </div>
  )
}
