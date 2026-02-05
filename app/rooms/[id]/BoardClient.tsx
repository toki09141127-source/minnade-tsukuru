'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
  const [posts, setPosts] = useState<PostRow[]>([])
  const [content, setContent] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needProfile, setNeedProfile] = useState(false)

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
      setNeedProfile(false)

      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id ?? null
      setUserId(uid)

      await refresh()

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
    setNeedProfile(false)

    if (roomStatus !== 'open') return setError('現在は投稿できません（closed）')
    if (!joined) return setError('参加者のみ投稿できます')
    if (!content.trim()) return

    // ✅ username 未設定ガード
    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id
    if (uid) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', uid)
        .maybeSingle()

      const uname = (prof?.username ?? '').trim()
      if (!uname) {
        setNeedProfile(true)
        return setError('投稿するにはユーザー名の設定が必要です')
      }
    }

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
        body: JSON.stringify({ roomId, content }),
      })

      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? '投稿失敗')
        return
      }

      setPosts((prev) => [...prev, json.post as PostRow])
      setContent('')
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
  }

  return (
    <section style={{ marginTop: 18 }}>
      <h2>掲示板</h2>

      {roomStatus !== 'open' ? (
        <p style={{ color: '#b00020' }}>現在は投稿できません。（status=open のときのみ）</p>
      ) : !joined ? (
        <p style={{ color: '#666' }}>投稿するには参加してください。</p>
      ) : (
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
        </div>
      )}

      {error && (
        <p style={{ color: '#b00020' }}>
          {error}{' '}
          {needProfile && (
            <>
              <Link href="/profile">→ プロフィールへ</Link>
            </>
          )}
        </p>
      )}

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
