'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase/client'

type PostRow = {
  id: string
  user_id: string
  username: string | null
  content: string
  created_at: string
  post_type?: string | null
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
  const [content, setContent] = useState('')
  const [finalContent, setFinalContent] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 現在ユーザー取得
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      setUserId(data.user?.id ?? null)
    }
    init()
  }, [])

  // 投稿取得（5秒ポーリング）
  const fetchPosts = useCallback(async () => {
    setError('')
    const { data, error } = await supabase
      .from('posts')
      .select('id, user_id, username, content, created_at, post_type, deleted_at')
      .eq('room_id', roomId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setPosts((data ?? []) as PostRow[])
  }, [roomId])

  useEffect(() => {
    fetchPosts()
    const interval = setInterval(fetchPosts, 5000)
    return () => clearInterval(interval)
  }, [fetchPosts])

  // 投稿送信（log / final）
  const submitPost = async (type: 'log' | 'final') => {
    const text = type === 'log' ? content.trim() : finalContent.trim()
    if (!text) return

    if (roomStatus !== 'open') {
      alert('このルームでは投稿できません')
      return
    }

    setLoading(true)

    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token

    const res = await fetch('/api/posts/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        roomId,
        content: text,
        post_type: type,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? '投稿失敗')
    } else {
      if (type === 'log') setContent('')
      else setFinalContent('')
      fetchPosts()
    }

    setLoading(false)
  }

  // 取り消し
  const deletePost = async (postId: string) => {
    if (!confirm('投稿を取り消しますか？')) return

    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token

    const res = await fetch('/api/posts/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ postId }),
    })

    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? '削除失敗')
    } else {
      fetchPosts()
    }
  }

  const finalPosts = posts.filter((p) => p.post_type === 'final')
  const logPosts = posts.filter((p) => !p.post_type || p.post_type === 'log')

  return (
    <section style={{ marginTop: 18 }}>
      <h2>完成作品（最終提出）</h2>

      {finalPosts.length === 0 ? (
        <p style={{ color: '#666' }}>まだ最終提出がありません。</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {finalPosts.map((p) => (
            <div key={p.id} style={{ border: '1px solid #ddd', padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{p.username ?? '名無し'}</strong>
                <span>{new Date(p.created_at).toLocaleString()}</span>
              </div>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{p.content}</div>
              {p.user_id === userId && (
                <button onClick={() => deletePost(p.id)}>取り消し</button>
              )}
            </div>
          ))}
        </div>
      )}

      {roomStatus === 'open' && (
        <div style={{ marginTop: 12 }}>
          <textarea
            value={finalContent}
            onChange={(e) => setFinalContent(e.target.value)}
            placeholder="最終提出を書く..."
            style={{ width: '100%', minHeight: 80 }}
          />
          <button disabled={loading} onClick={() => submitPost('final')}>
            最終提出する
          </button>
        </div>
      )}

      <hr style={{ margin: '24px 0' }} />

      <h2>制作ログ（掲示板）</h2>

      {logPosts.length === 0 ? (
        <p style={{ color: '#666' }}>まだ投稿がありません。</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {logPosts.map((p) => (
            <div key={p.id} style={{ border: '1px solid #eee', padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{p.username ?? '名無し'}</strong>
                <span>{new Date(p.created_at).toLocaleString()}</span>
              </div>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{p.content}</div>
              {p.user_id === userId && (
                <button onClick={() => deletePost(p.id)}>取り消し</button>
              )}
            </div>
          ))}
        </div>
      )}

      {roomStatus === 'open' && (
        <div style={{ marginTop: 12 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="制作ログを書く..."
            style={{ width: '100%', minHeight: 80 }}
          />
          <button disabled={loading} onClick={() => submitPost('log')}>
            投稿する
          </button>
        </div>
      )}

      {error && <p style={{ color: '#b00020' }}>{error}</p>}
    </section>
  )
}
