// app/rooms/[id]/PostFormClient.tsx
'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function PostFormClient({
  roomId,
  roomStatus,
  onPosted,
}: {
  roomId: string
  roomStatus: string
  onPosted?: () => void
}) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async () => {
    if (loading) return
    if (roomStatus !== 'open') {
      setError('このルームは open ではありません')
      return
    }
    const trimmed = content.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')
    setInfo('投稿中…')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setError('Not authenticated')
        return
      }

      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, content: trimmed }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? `投稿に失敗しました (status=${res.status})`)
        return
      }

      setContent('')
      setInfo('投稿しました')
      onPosted?.()
    } catch (e: any) {
      setError(e?.message ?? '投稿に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="投稿内容…"
        style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
      />
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={submit}
          disabled={loading || roomStatus !== 'open'}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
          }}
        >
          {loading ? '送信中…' : '投稿する'}
        </button>

        {info && <span style={{ fontSize: 12, color: '#555' }}>{info}</span>}
      </div>

      {error && <p style={{ color: '#b00020', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
