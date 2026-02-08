// app/rooms/[id]/BoardClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)

  const isOpen = roomStatus === 'open'

  // 自分のID（削除ボタン表示用）
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMeId(data.user?.id ?? null)
    })
  }, [])

  const fetchPosts = async () => {
    setError('')
    const { data, error } = await supabase
      .from('posts')
      .select('id, user_id, username, content, created_at')
      .eq('room_id', roomId)
      .eq('is_hidden', false) // ✅ 非表示投稿を除外（ここが重要）
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setPosts((data ?? []) as PostRow[])
  }

  useEffect(() => {
    fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const canPost = useMemo(() => {
    return isOpen && content.trim().length > 0 && !loading
  }, [isOpen, content, loading])

  const submit = async () => {
    if (!canPost) return
    setLoading(true)
    setError('')
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
        // ユーザー名未設定誘導などをここに入れているなら、そのままOK
        setError(json.error ?? '投稿に失敗しました')
        return
      }

      setContent('')
      await fetchPosts()
    } finally {
      setLoading(false)
    }
  }

  const deletePost = async (postId: string) => {
    if (!confirm('この投稿を削除しますか？')) return
    setError('')
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setError('ログインしてください')
        return
      }

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
        setError(json.error ?? '削除に失敗しました')
        return
      }

      await fetchPosts()
    } catch (e: any) {
      setError(e?.message ?? '削除に失敗しました')
    }
  }

  return (
    <section style={{ marginTop: 18 }}>
      <h2>掲示板</h2>

      {!isOpen && (
        <div style={{ marginTop: 10, padding: 12, background: '#fff7e6', borderRadius: 10 }}>
          <b>このルームは現在 open ではありません。</b>
          <div style={{ marginTop: 6, fontSize: 14, color: '#444' }}>
            投稿は停止中です（閲覧のみ）。
          </div>
        </div>
      )}

      {/* 投稿フォーム */}
      <div style={{ marginTop: 10 }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isOpen ? '制作の進捗・アイデア・役割分担などを書こう' : 'このルームは投稿できません'}
          disabled={!isOpen}
          style={{
            width: '100%',
            minHeight: 110,
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 10,
            padding: 12,
            lineHeight: 1.7,
          }}
        />

        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={submit}
            disabled={!canPost}
            style={{
              padding: '10px 14px',
              border: '1px solid #111',
              borderRadius: 10,
              cursor: canPost ? 'pointer' : 'not-allowed',
              background: '#111',
              color: '#fff',
              opacity: canPost ? 1 : 0.5,
            }}
          >
            {loading ? '投稿中…' : '投稿'}
          </button>

          <Link href="/profile" style={{ fontSize: 14 }}>
            ユーザー名を設定
          </Link>
        </div>

        {error && <p style={{ marginTop: 10, color: '#b00020' }}>{error}</p>}
      </div>

      {/* 投稿一覧 */}
      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {posts.length === 0 ? (
          <p style={{ color: '#666' }}>まだ投稿がありません。</p>
        ) : (
          posts.map((p) => (
            <div
              key={p.id}
              style={{
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 10,
                padding: 12,
                background: 'rgba(255,255,255,0.9)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong>{p.username ?? '名無し'}</strong>
                <span style={{ fontSize: 12, color: '#666' }}>
                  {new Date(p.created_at).toLocaleString('ja-JP')}
                </span>
              </div>

              <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {p.content}
              </div>

              {/* 自分の投稿だけ削除 */}
              {meId && p.user_id === meId && (
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => deletePost(p.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(0,0,0,0.18)',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
