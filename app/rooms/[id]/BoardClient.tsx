'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
import ReportButton from './ReportButton'

type PostRow = {
  id: string
  room_id: string
  user_id: string
  username: string | null
  content: string
  created_at: string
  post_type: 'log' | 'final'
  deleted_at: string | null
  is_hidden: boolean
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
  const [loading, setLoading] = useState(false)

  // 投稿フォーム
  const [logText, setLogText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [posting, setPosting] = useState<'log' | 'final' | null>(null)

  // 削除
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 自分ID（削除ボタン表示用）
  const [myUserId, setMyUserId] = useState<string | null>(null)

  // ポーリング制御
  const timerRef = useRef<number | null>(null)
  const fetchingRef = useRef(false)

  const canPost = roomStatus === 'open'

  const fetchPosts = useCallback(async () => {
    if (!roomId) return
    if (fetchingRef.current) return
    fetchingRef.current = true

    setError('')
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, room_id, user_id, username, content, created_at, post_type, deleted_at, is_hidden')
        .eq('room_id', roomId)
        .eq('is_hidden', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (error) {
        setError(error.message)
        return
      }
      setPosts((data ?? []) as PostRow[])
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [roomId])

  // 初期：自分ID取得 + 初回fetch
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!alive) return
      setMyUserId(data.user?.id ?? null)
    })()
    return () => {
      alive = false
    }
  }, [])

  // 初回fetch + ポーリング（5秒）
  useEffect(() => {
    fetchPosts()

    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      fetchPosts()
    }, 5000)

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [fetchPosts])

  const finalLatest = useMemo(() => {
    const finals = posts.filter((p) => p.post_type === 'final')
    if (finals.length === 0) return null
    return finals[finals.length - 1] // created_at昇順で来ている想定なので最後が最新
  }, [posts])

  const logs = useMemo(() => posts.filter((p) => p.post_type === 'log'), [posts])

  const postToApi = useCallback(
    async (postType: 'log' | 'final', content: string) => {
      setError('')
      setPosting(postType)
      try {
        const { data: s } = await supabase.auth.getSession()
        const token = s.session?.access_token
        if (!token) {
          setError('ログインが必要です')
          return
        }

        const res = await fetch('/api/posts/create', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            roomId,
            content,
            postType, // create API側が未対応なら後で合わせる
          }),
        })

        const json = await res.json()
        if (!res.ok || !json.ok) {
          setError(json?.error ?? '投稿に失敗しました')
          return
        }

        // 入力クリア
        if (postType === 'log') setLogText('')
        else setFinalText('')

        // すぐ反映
        await fetchPosts()
      } catch (e: any) {
        setError(e?.message ?? '投稿に失敗しました')
      } finally {
        setPosting(null)
      }
    },
    [fetchPosts, roomId],
  )

  const onDelete = useCallback(
    async (postId: string) => {
      if (!confirm('この投稿を取り消しますか？（論理削除）')) return

      setDeletingId(postId)
      setError('')
      try {
        const { data: s } = await supabase.auth.getSession()
        const token = s.session?.access_token
        if (!token) {
          setError('ログインが必要です')
          return
        }

        const res = await fetch('/api/posts/delete', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ postId }),
        })

        const json = await res.json()
        if (!res.ok || !json.ok) {
          setError(json?.error ?? '取り消しに失敗しました')
          return
        }

        await fetchPosts()
      } catch (e: any) {
        setError(e?.message ?? '取り消しに失敗しました')
      } finally {
        setDeletingId(null)
      }
    },
    [fetchPosts],
  )

  return (
    <section style={{ marginTop: 18 }}>
      <h2>掲示板</h2>

      {error && <p style={{ color: '#b00020' }}>{error}</p>}
      {loading && <p style={{ color: '#666' }}>更新中...</p>}

      {/* ===== 最終提出 ===== */}
      <div
        style={{
          marginTop: 14,
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 12,
          padding: 12,
          background: 'rgba(255,255,255,0.75)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15 }}>最終提出（完成作品）</h3>
        <p style={{ marginTop: 6, marginBottom: 10, fontSize: 12, opacity: 0.8 }}>
          ここに投稿した内容が「完成作品」として扱われます（最新の1件を表示）。
        </p>

        {finalLatest ? (
          <div
            style={{
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 10,
              padding: 12,
              background: 'rgba(255,255,255,0.9)',
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <strong>{finalLatest.username ?? '名無し'}</strong>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {new Date(finalLatest.created_at).toLocaleString('ja-JP')}
              </span>

              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <ReportButton targetType="post" targetId={finalLatest.id} />
                {myUserId && finalLatest.user_id === myUserId && (
                  <button
                    onClick={() => onDelete(finalLatest.id)}
                    disabled={deletingId === finalLatest.id}
                    style={{
                      border: '1px solid rgba(0,0,0,0.15)',
                      borderRadius: 8,
                      padding: '6px 10px',
                      background: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    {deletingId === finalLatest.id ? '取り消し中...' : '取り消し'}
                  </button>
                )}
              </span>
            </div>

            <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {finalLatest.content}
            </div>
          </div>
        ) : (
          <p style={{ marginTop: 10, color: '#666' }}>まだ最終提出がありません。</p>
        )}

        <div style={{ marginTop: 12 }}>
          <textarea
            value={finalText}
            onChange={(e) => setFinalText(e.target.value)}
            placeholder="完成作品（最終提出）を入力..."
            rows={4}
            style={{
              width: '100%',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 10,
              padding: 10,
              resize: 'vertical',
            }}
            disabled={!canPost || posting !== null}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{finalText.length}/2000</span>
            <button
              onClick={() => postToApi('final', finalText.trim())}
              disabled={!canPost || posting !== null || finalText.trim().length === 0}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {posting === 'final' ? '送信中...' : '最終提出する'}
            </button>
          </div>
        </div>

        {!canPost && (
          <p style={{ marginTop: 12, color: '#666' }}>
            このルームは {roomStatus} のため、新規投稿はできません。
          </p>
        )}
      </div>

      {/* ===== 制作ログ ===== */}
      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>制作ログ（掲示板）</h3>

        <div style={{ marginTop: 10 }}>
          <textarea
            value={logText}
            onChange={(e) => setLogText(e.target.value)}
            placeholder="制作ログを入力..."
            rows={3}
            style={{
              width: '100%',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 10,
              padding: 10,
              resize: 'vertical',
            }}
            disabled={!canPost || posting !== null}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{logText.length}/2000</span>
            <button
              onClick={() => postToApi('log', logText.trim())}
              disabled={!canPost || posting !== null || logText.trim().length === 0}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {posting === 'log' ? '送信中...' : '投稿する'}
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <p style={{ marginTop: 12, color: '#666' }}>まだ投稿がありません。</p>
        ) : (
          <ul style={{ paddingLeft: 18, marginTop: 12 }}>
            {logs.map((p) => (
              <li key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <strong>{p.username ?? '名無し'}</strong>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    {new Date(p.created_at).toLocaleString('ja-JP')}
                  </span>

                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <ReportButton targetType="post" targetId={p.id} />
                    {myUserId && p.user_id === myUserId && (
                      <button
                        onClick={() => onDelete(p.id)}
                        disabled={deletingId === p.id}
                        style={{
                          border: '1px solid rgba(0,0,0,0.15)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          background: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        {deletingId === p.id ? '取り消し中...' : '取り消し'}
                      </button>
                    )}
                  </span>
                </div>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{p.content}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
