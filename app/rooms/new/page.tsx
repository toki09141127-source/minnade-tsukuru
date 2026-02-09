// app/rooms/new/page.tsx
'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NewRoomPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('novel')
  const [isAdult, setIsAdult] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setError('Not authenticated')
        return
      }

      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim() || '（無題）',
          kind,
          is_adult: isAdult,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? `作成に失敗しました (status=${res.status})`)
        return
      }

      router.push(`/rooms/${json.roomId}`)
    } catch (e: any) {
      setError(e?.message ?? '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1 className="h1">ルーム作成</h1>

      <div className="card">
        <div className="stack">
          <label>
            <div className="muted">タイトル</div>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：短編を仕上げる" />
          </label>

          <label>
            <div className="muted">カテゴリ</div>
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="novel">novel</option>
              <option value="manga">manga</option>
              <option value="anime">anime</option>
              <option value="illustration">illustration</option>
              <option value="other">other</option>
            </select>
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} />
            <span>成人向け（R18）として作成する</span>
          </label>

          <button
            onClick={create}
            disabled={loading}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '作成中…' : '作成する'}
          </button>

          {error && <p style={{ color: '#b00020' }}>{error}</p>}
        </div>
      </div>
    </div>
  )
}
