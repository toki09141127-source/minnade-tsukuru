// app/rooms/[id]/BoardClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

type PostRow = {
  id: string
  user_id: string
  username: string | null
  content: string
  created_at: string
}

export default function BoardClient({
  roomId,
  roomStatus,
}: {
  roomId: string
  roomStatus: string
}) {
  const router = useRouter()

  const [posts, setPosts] = useState<PostRow[]>([])
  const [content, setContent] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [username, setUsername] = useState<string>('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canPost = useMemo(() => {
    return roomStatus === 'open' && joined && !!userId && username.trim().length > 0 && !loading
  }, [roomStatus, joined, userId, username, loading])

  const refresh = async () => {
    const { data: p } = await supabase
      .from('posts')
      .select('id, user_id, username, content, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
    setPosts((p ?? []) as PostRow[])
  }

  useEffect(() => {
    const init = async () => {
      setError('')

      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id ?? null
      setUserId(uid)

      await refresh()

      if (!uid) return

      // username（profiles）
      const { data: prof } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle()
      setUsername((prof?.username ?? '').trim())

      // 参加済み確認
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
    if (roomStatus !== 'open') return setError('現在は投稿できません（closed）')
    if (!joined) return setError('参加者のみ投稿できます')
    if (!userId) return setError('ログインしてください')

    // ✅ username未設定なら /profile へ
    if (!username.trim()) {
      router.push('/profile')
      return
    }

    const text = content.trim()
    if (!text) return
    if (text.length > 500) return setError('500文字以内にしてください')

    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setError('ログインしてください')
        return
      }

      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, content: text }),
      })

      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? '投稿失敗')
        return
      }

      setPosts((prev) => [...prev, json.post as PostRow])
      setContent('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const del = async (postId: string) => {
    if (!confirm('削除しますか？')) return
    setError('')

    const { data: s } = await supabase.auth.getSession()
    const token = s.session?.access_token
    if (!token) return setError('ログインしてください')

    const res = await fetch('/api/posts/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ postId }),
    })

    const json = await res.json()
    if (!json.ok) {
      setError(json.error ?? '削除失敗')
      return
    }

    setPosts((prev) => prev.filter((p) => p.id !== postId))
    router.refresh()
  }

  return (
    <section style={{ marginTop: 18 }}>
      <h2>掲示板</h2>

      {roomStatus !== 'open' ? (
        <p style={{ color: '#b00020' }}>現在は投稿できません。（status=open のときのみ）</p>
      ) : !userId ? (
        <p style={{ color: '#666' }}>投稿するにはログインしてください。</p>
      ) : !username.trim() ? (
        <p style={{ color: '#b00020' }}>
          投稿するには <a href="/profile">ユーザー名を設定</a> してください。
        </p>
      ) : !joined ? (
        <p style={{ color: '#666' }}>投稿するには参加してください。</p>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="アイデア・案・メモを投げよう（500文字まで）"
            style={{
              width: '100%',
              border: '1px solid #ccc',
              borderRadius: 10,
              padding: 10,
            }}
          />
          <button
            onClick={post}
            disabled={!canPost}
            style={{
              marginTop: 8,
              padding: '10px 14px',
              border: '1px solid #111',
              borderRadius: 8,
              cursor: canPost ? 'pointer' : 'not-allowed',
              background: '#111',
              color: '#fff',
              opacity: canPost ? 1 : 0.5,
            }}
          >
            {loading ? '投稿中…' : '投稿'}
          </button>
        </div>
      )}

      {error && <p style={{ color: '#b00020' }}>{error}</p>}

      {posts.length === 0 ? (
        <p style={{ color: '#666' }}>まだ投稿がありません。</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {posts.map((p) => (
            <div key={p.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#666' }}>
                <strong>{p.username ?? '名無し'}</strong> / {new Date(p.created_at).toLocaleString()}
              </div>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{p.content}</div>

              {p.user_id === userId && (
                <button
                  onClick={() => del(p.id)}
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: '#b00020',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  削除
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
