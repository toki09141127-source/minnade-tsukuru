// app/rooms/[id]/BoardClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
import ReportButton from './ReportButton'

type PostRow = {
  id: string
  user_id: string
  username: string | null
  content: string
  created_at: string
  is_hidden?: boolean
  deleted_at?: string | null
}

export default function BoardClient({
  roomId,
  roomStatus,
}: {
  roomId: string
  roomStatus: string
}) {
  const [posts, setPosts] = useState<PostRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchPosts = async () => {
      setError('')

      const { data, error } = await supabase
        .from('posts')
        .select('id, user_id, username, content, created_at, is_hidden, deleted_at')
        .eq('room_id', roomId)
        .eq('is_hidden', false) // ✅ 非表示除外
        .is('deleted_at', null) // ✅ 論理削除除外（あってもなくてもOK）
        .order('created_at', { ascending: true })

      if (error) setError(error.message)
      else setPosts((data ?? []) as PostRow[])
    }

    fetchPosts()
  }, [roomId])

  return (
    <section style={{ marginTop: 18 }}>
      <h2>掲示板</h2>

      {error && <p style={{ color: '#b00020' }}>{error}</p>}

      {posts.length === 0 ? (
        <p style={{ color: '#666' }}>まだ投稿がありません。</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {posts.map((p) => (
            <li key={p.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <strong>{p.username ?? '名無し'}</strong>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(p.created_at).toLocaleString()}
                </span>

                {/* ✅ 投稿の通報（必要なら残す） */}
                <span style={{ marginLeft: 'auto' }}>
                  <ReportButton targetType="post" targetId={p.id} />
                </span>
              </div>
              <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{p.content}</div>
            </li>
          ))}
        </ul>
      )}

      {roomStatus !== 'open' && (
        <p style={{ marginTop: 12, color: '#666' }}>
          このルームは {roomStatus} のため、新規投稿はできません。
        </p>
      )}
    </section>
  )
}
