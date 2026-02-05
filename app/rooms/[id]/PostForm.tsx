// app/rooms/[id]/PostForm.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function PostForm({
  roomId,
  roomStatus,
  onPosted,
}: {
  roomId: string
  roomStatus: string
  onPosted?: () => void
}) {
  const [content, setContent] = useState('')
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      setError('')
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return

      const { data: mem } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', uid)
        .maybeSingle()

      setJoined(!!mem)
    }
    init()
  }, [roomId])

  const post = async () => {
    setError('')
    if (roomStatus !== 'open') return setError('現在は投稿できません（status=open のときのみ）')
    if (!joined) return setError('参加者のみ投稿できます')
    if (!content.trim()) return

    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) return setError('ログインしてください')

      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, content }),
      })

      const json = await res.json()
      if (!json.ok) return setError(json.error ?? '投稿失敗')

      setContent('')
      onPosted?.()
    } finally {
      setLoading(false)
    }
  }

  if (roomStatus !== 'open') {
    return <p style={{ color: '#b00020' }}>現在は投稿できません。（status=open のときのみ）</p>
  }
  if (!joined) {
    return <p style={{ color: '#666' }}>投稿するには参加してください。</p>
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="アイデア・案・メモを投げよう"
        style={{
          width: '100%',
          border: '1px solid #ccc',
          borderRadius: 10,
          padding: 10,
        }}
      />
      <button
        onClick={post}
        disabled={loading}
        style={{
          marginTop: 8,
          padding: '10px 14px',
          border: '1px solid #111',
          borderRadius: 8,
          cursor: 'pointer',
          background: '#111',
          color: '#fff',
        }}
      >
        {loading ? '投稿中…' : '投稿'}
      </button>

      {error && <p style={{ color: '#b00020', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
