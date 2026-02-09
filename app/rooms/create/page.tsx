// app/rooms/create/page.tsx
'use client'

import { useState } from 'react'

export default function CreateRoomPage() {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('novel')
  const [isAdult, setIsAdult] = useState<'safe' | 'adult'>('safe')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          kind,
          isAdult: isAdult === 'adult',
        }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(json?.error ?? '作成に失敗しました')
        return
      }

      // 作成後、ルーム詳細に飛ぶ想定
      if (json?.roomId) {
        window.location.href = `/rooms/${json.roomId}`
      } else {
        window.location.href = `/rooms`
      }
    } catch (e: any) {
      setError(e?.message ?? '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1 className="h1">ルーム作成</h1>

      <div className="card stack">
        <div className="stack">
          <label className="muted">タイトル</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：短編小説を完成させる" />
        </div>

        <div className="stack">
          <label className="muted">カテゴリ</label>
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="novel">novel</option>
            <option value="manga">manga</option>
            <option value="anime">anime</option>
            <option value="game">game</option>
            <option value="other">other</option>
          </select>
        </div>

        <div className="stack">
          <label className="muted">対象</label>
          <select className="select" value={isAdult} onChange={(e) => setIsAdult(e.target.value as any)}>
            <option value="safe">一般向け</option>
            <option value="adult">成人向け</option>
          </select>
          <div className="muted" style={{ fontSize: 12 }}>
            成人向けにすると、一覧の「一般のみ」では非表示になります。
          </div>
        </div>

        <button
          onClick={submit}
          disabled={loading}
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '作成中…' : '作成する'}
        </button>

        {error && <p style={{ color: '#b00020', marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  )
}
