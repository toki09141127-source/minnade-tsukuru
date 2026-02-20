'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../../lib/supabase/client'
import JoinButton from './JoinButton'

type Role = 'creator' | 'core' | 'supporter' | null

type PostRow = {
  id: string
  user_id: string
  username: string | null
  content: string
  created_at: string
  post_type?: string | null
  deleted_at?: string | null
  attachment_url?: string | null
  attachment_type?: string | null

  // ✅ marking
  is_marked: boolean
  marked_by?: string | null
  marked_at?: string | null
}

const ACCEPT = 'image/*,video/mp4,video/webm'

export default function BoardClient({
  roomId,
  roomStatus,
  myRole,
}: {
  roomId: string
  roomStatus: string
  myRole: Role
}) {
  const [posts, setPosts] = useState<PostRow[]>([])
  const [error, setError] = useState('')
  const [content, setContent] = useState('')
  const [finalContent, setFinalContent] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // ✅ 参加済みか（親からのmyRoleで判定）
  const isMember = !!myRole
  const memberChecked = true

  // 添付（log / final）
  const [logFile, setLogFile] = useState<File | null>(null)
  const [finalFile, setFinalFile] = useState<File | null>(null)

  // signed url cache: postId -> signedUrl
  const [signedMap, setSignedMap] = useState<Record<string, string>>({})

  // ✅ Mark filter
  const [markFilter, setMarkFilter] = useState<'all' | 'marked'>('all')

  const canMark = myRole === 'core' || myRole === 'creator'

  // ✅ iPhone対応：confirm()をやめて自前モーダルにする
  const [confirmTarget, setConfirmTarget] = useState<{ postId: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ✅ ボタン（黒背景＋白文字）スタイル
  const primaryButtonStyle: React.CSSProperties = {
    background: '#111',
    color: '#fff',
    border: '1px solid #111',
    borderRadius: 10,
    padding: '10px 16px',
    fontWeight: 800,
    cursor: 'pointer',
    opacity: loading ? 0.7 : 1,
  }

  const smallButtonStyle: React.CSSProperties = {
    background: '#fff',
    color: '#111',
    border: '1px solid rgba(0,0,0,0.20)',
    borderRadius: 10,
    padding: '6px 10px',
    fontWeight: 900,
    cursor: 'pointer',
  }

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id ?? null
      setUserId(uid)
    }
    init()
  }, [])

  const getToken = async () => {
    const session = await supabase.auth.getSession()
    return session.data.session?.access_token ?? null
  }

  const fetchPosts = useCallback(async () => {
    setError('')
    const { data, error } = await supabase
      .from('posts')
      .select(
        'id, user_id, username, content, created_at, post_type, deleted_at, attachment_url, attachment_type, is_marked, marked_by, marked_at'
      )
      .eq('room_id', roomId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    const rows = (data ?? []) as PostRow[]
    setPosts(rows)

    const need = rows.filter((p) => p.attachment_url && !signedMap[p.id])
    if (need.length === 0) return

    const token = await getToken()
    if (!token) return

    await Promise.all(
      need.map(async (p) => {
        try {
          const res = await fetch('/api/uploads/sign', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ postId: p.id }),
          })
          const json = await res.json()
          if (res.ok && json?.signedUrl) {
            setSignedMap((prev) => ({ ...prev, [p.id]: String(json.signedUrl) }))
          }
        } catch {
          // noop
        }
      })
    )
  }, [roomId, signedMap])

  useEffect(() => {
    fetchPosts()
    const interval = setInterval(fetchPosts, 5000)
    return () => clearInterval(interval)
  }, [fetchPosts])

  const uploadFile = async (file: File): Promise<{ storagePath: string; mimeType: string } | null> => {
    const token = await getToken()
    if (!token) {
      alert('ログインが必要です')
      return null
    }

    const form = new FormData()
    form.append('roomId', roomId)
    form.append('file', file)

    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })

    const json = await res.json()
    if (!res.ok) {
      alert(json?.error ?? 'アップロード失敗')
      return null
    }

    return { storagePath: String(json.storagePath), mimeType: String(json.mimeType ?? file.type ?? '') }
  }

  const submitPost = async (type: 'log' | 'final') => {
    if (roomStatus === 'open' && memberChecked && !isMember) {
      alert('ルームに参加してから投稿してください')
      return
    }

    const text = type === 'log' ? content.trim() : finalContent.trim()
    const file = type === 'log' ? logFile : finalFile

    if (!text && !file) {
      alert('本文か画像/動画のどちらかを入力してください')
      return
    }

    if (roomStatus !== 'open') {
      alert('このルームでは投稿できません')
      return
    }

    setLoading(true)

    const token = await getToken()
    if (!token) {
      alert('ログインが必要です')
      setLoading(false)
      return
    }

    let attachment_url: string | null = null
    let attachment_type: string | null = null

    if (file) {
      const uploaded = await uploadFile(file)
      if (!uploaded) {
        setLoading(false)
        return
      }
      attachment_url = uploaded.storagePath
      attachment_type = uploaded.mimeType
    }

    const res = await fetch('/api/posts/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        roomId,
        content: text || '(添付のみ)',
        post_type: type,
        attachment_url,
        attachment_type,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? '投稿失敗')
      setLoading(false)
      return
    }

    if (type === 'log') {
      setContent('')
      setLogFile(null)
    } else {
      setFinalContent('')
      setFinalFile(null)
    }

    await fetchPosts()
    setLoading(false)
  }

  // ✅ 取り消し：confirm()廃止 → モーダルを開くだけ
  const deletePost = async (postId: string) => {
    if (roomStatus === 'open' && memberChecked && !isMember) {
      alert('ルームに参加してから操作してください')
      return
    }
    setConfirmTarget({ postId })
  }

  // ✅ 実際の削除処理（モーダルの「取り消す」から呼ぶ）
  const executeDeletePost = async (postId: string) => {
    if (deleting) return
    setDeleting(true)

    try {
      const token = await getToken()
      if (!token) {
        alert('ログインが必要です')
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

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(json.error ?? '削除失敗')
        return
      }

      await fetchPosts()
    } finally {
      setDeleting(false)
      setConfirmTarget(null)
    }
  }

  const toggleMark = async (postId: string) => {
    if (!canMark) return
    const token = await getToken()
    if (!token) {
      alert('ログインが必要です')
      return
    }

    const before = posts.find((p) => p.id === postId)
    if (!before) return

    const optimisticNext = !before.is_marked
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              is_marked: optimisticNext,
              marked_by: optimisticNext ? userId : null,
              marked_at: optimisticNext ? new Date().toISOString() : null,
            }
          : p
      )
    )

    try {
      const res = await fetch('/api/posts/toggle-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId, roomId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? before : p)))
        alert(json?.error ?? 'マーキングに失敗しました')
        return
      }

      const updated = json?.post as
        | { id: string; is_marked: boolean; marked_by: string | null; marked_at: string | null }
        | null

      if (updated?.id) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === updated.id
              ? {
                  ...p,
                  is_marked: !!updated.is_marked,
                  marked_by: updated.marked_by ?? null,
                  marked_at: updated.marked_at ?? null,
                }
              : p
          )
        )
      } else {
        await fetchPosts()
      }
    } catch {
      setPosts((prev) => prev.map((p) => (p.id === postId ? before : p)))
      alert('通信に失敗しました')
    }
  }

  const finalPostsAll = useMemo(() => posts.filter((p) => p.post_type === 'final'), [posts])
  const logPostsAll = useMemo(() => posts.filter((p) => !p.post_type || p.post_type === 'log'), [posts])

  const applyMarkFilter = useCallback(
    (rows: PostRow[]) => {
      if (markFilter === 'marked') return rows.filter((p) => p.is_marked)
      return rows
    },
    [markFilter]
  )

  const finalPosts = applyMarkFilter(finalPostsAll)
  const logPosts = applyMarkFilter(logPostsAll)

  const renderAttachment = (p: PostRow) => {
    if (!p.attachment_url) return null

    const mime = (p.attachment_type ?? '').toLowerCase()
    const signedUrl = signedMap[p.id]

    if (!signedUrl) {
      return <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>添付を読み込み中…</div>
    }

    if (mime.startsWith('image/')) {
      return (
        <div style={{ marginTop: 8 }}>
          <img
            src={signedUrl}
            alt="attachment"
            style={{
              maxWidth: '100%',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.10)',
              display: 'block',
            }}
          />
        </div>
      )
    }

    if (mime.startsWith('video/')) {
      return (
        <div style={{ marginTop: 8 }}>
          <video
            src={signedUrl}
            controls
            preload="metadata"
            style={{
              maxWidth: '100%',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.10)',
              display: 'block',
            }}
          />
        </div>
      )
    }

    return (
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
        添付ファイル（未対応形式）：{mime || 'unknown'}
      </div>
    )
  }

  const showPostForms = roomStatus === 'open' && userId && memberChecked && isMember
  const showJoinHint = roomStatus === 'open' && userId && memberChecked && !isMember

  const renderMarkBadge = (p: PostRow) => {
    if (!p.is_marked) return null
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 900,
          padding: '3px 8px',
          borderRadius: 999,
          border: '1px solid rgba(0,0,0,0.18)',
          background: '#fff7e6',
        }}
        title={p.marked_at ? `marked_at: ${new Date(p.marked_at).toLocaleString()}` : 'marked'}
      >
        ⭐ 重要
      </span>
    )
  }

  const cardStyle = (p: PostRow): React.CSSProperties => {
    if (!p.is_marked) {
      return { border: '1px solid #eee', borderRadius: 10, padding: 12, background: '#fff' }
    }
    return {
      border: '2px solid rgba(255, 170, 0, 0.60)',
      borderRadius: 10,
      padding: 12,
      background: '#fffdf5',
    }
  }

  // ✅ username を公開プロフィールにリンク（/u/[username]）
  const UserLink = ({ p }: { p: PostRow }) => {
    const name = (p.username ?? '').trim()

    if (!name) {
      return (
        <span style={{ fontWeight: 900, color: '#111', opacity: 0.6 }} title="ユーザー名未設定">
          unknown
        </span>
      )
    }

    return (
      <Link
        href={`/u/${encodeURIComponent(name)}`}
        style={{ fontWeight: 900, textDecoration: 'none', color: '#111' }}
        title="公開プロフィールを見る"
      >
        {name}
      </Link>
    )
  }

  return (
    <section style={{ marginTop: 18 }}>
      {/* 参加していない場合の案内 */}
      {showJoinHint && (
        <div
          style={{
            marginBottom: 14,
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: 12,
            padding: 12,
            background: '#fff7e6',
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 900 }}>参加すると投稿できます</div>
          <div style={{ fontSize: 13, color: '#6b4a00', fontWeight: 700, marginTop: 4 }}>
            ルームに参加していないユーザーは、投稿（log/final）と取り消しができません。
          </div>
          <div style={{ marginTop: 10 }}>
            <JoinButton roomId={roomId} roomStatus={roomStatus} />
          </div>
        </div>
      )}

      {/* ✅ Mark filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 900 }}>表示:</div>
        <button
          onClick={() => setMarkFilter('all')}
          style={{
            ...smallButtonStyle,
            background: markFilter === 'all' ? '#111' : '#fff',
            color: markFilter === 'all' ? '#fff' : '#111',
            borderColor: markFilter === 'all' ? '#111' : 'rgba(0,0,0,0.20)',
          }}
        >
          すべて
        </button>
        <button
          onClick={() => setMarkFilter('marked')}
          style={{
            ...smallButtonStyle,
            background: markFilter === 'marked' ? '#111' : '#fff',
            color: markFilter === 'marked' ? '#fff' : '#111',
            borderColor: markFilter === 'marked' ? '#111' : 'rgba(0,0,0,0.20)',
          }}
        >
          ⭐ マーク済みのみ
        </button>
        {canMark && (
          <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.75 }}>
            ※core/creatorは投稿を「重要」にできます
          </span>
        )}
      </div>

      <h2>完成作品（最終提出）</h2>

      {finalPosts.length === 0 ? (
        <p style={{ color: '#666' }}>まだ最終提出がありません。</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {finalPosts.map((p) => (
            <div key={p.id} style={cardStyle(p)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <UserLink p={p} />
                  {renderMarkBadge(p)}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{new Date(p.created_at).toLocaleString()}</span>

                  {/* ✅ Mark toggle button（core/creatorのみ） */}
                  {canMark && (
                    <button
                      onClick={() => toggleMark(p.id)}
                      style={{
                        ...smallButtonStyle,
                        background: p.is_marked ? '#111' : '#fff',
                        color: p.is_marked ? '#fff' : '#111',
                        borderColor: p.is_marked ? '#111' : 'rgba(0,0,0,0.20)',
                      }}
                      title={p.is_marked ? '重要を解除' : '重要にする'}
                    >
                      {p.is_marked ? '⭐解除' : '⭐重要'}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{p.content}</div>
              {renderAttachment(p)}

              {/* ✅ 削除ボタン：投稿者本人 かつ 参加者（UX） */}
              {p.user_id === userId && roomStatus === 'open' && isMember && (
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => deletePost(p.id)}
                    style={smallButtonStyle}
                  >
                    取り消し
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ✅ 未参加ならフォームを出さない */}
      {showPostForms && (
        <div
          style={{
            marginTop: 12,
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: 12,
            padding: 12,
            background: '#fafafa',
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>最終提出を投稿</div>

          <textarea
            value={finalContent}
            onChange={(e) => setFinalContent(e.target.value)}
            placeholder="最終提出を書く…（画像/動画のみでもOK）"
            style={{ width: '100%', minHeight: 90, padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.18)' }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <input type="file" accept={ACCEPT} onChange={(e) => setFinalFile(e.target.files?.[0] ?? null)} />
            {finalFile && <span style={{ fontSize: 12, opacity: 0.75 }}>{finalFile.name}</span>}
            <button
              disabled={loading}
              onClick={() => submitPost('final')}
              style={{
                ...primaryButtonStyle,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '送信中…' : '最終提出する'}
            </button>
          </div>
        </div>
      )}

      <hr style={{ margin: '24px 0' }} />

      <h2>制作ログ（掲示板）</h2>

      {logPosts.length === 0 ? (
        <p style={{ color: '#666' }}>まだ投稿がありません。</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {logPosts.map((p) => (
            <div key={p.id} style={cardStyle(p)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <UserLink p={p} />
                  {renderMarkBadge(p)}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{new Date(p.created_at).toLocaleString()}</span>

                  {/* ✅ Mark toggle button（core/creatorのみ） */}
                  {canMark && (
                    <button
                      onClick={() => toggleMark(p.id)}
                      style={{
                        ...smallButtonStyle,
                        background: p.is_marked ? '#111' : '#fff',
                        color: p.is_marked ? '#fff' : '#111',
                        borderColor: p.is_marked ? '#111' : 'rgba(0,0,0,0.20)',
                      }}
                      title={p.is_marked ? '重要を解除' : '重要にする'}
                    >
                      {p.is_marked ? '⭐解除' : '⭐重要'}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{p.content}</div>
              {renderAttachment(p)}

              {/* ✅ 削除ボタン：投稿者本人 かつ 参加者（UX） */}
              {p.user_id === userId && roomStatus === 'open' && isMember && (
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => deletePost(p.id)}
                    style={smallButtonStyle}
                  >
                    取り消し
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ✅ 未参加ならフォームを出さない */}
      {showPostForms && (
        <div
          style={{
            marginTop: 12,
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: 12,
            padding: 12,
            background: '#fafafa',
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>制作ログを投稿</div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="制作ログを書く…（画像/動画のみでもOK）"
            style={{ width: '100%', minHeight: 90, padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.18)' }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <input type="file" accept={ACCEPT} onChange={(e) => setLogFile(e.target.files?.[0] ?? null)} />
            {logFile && <span style={{ fontSize: 12, opacity: 0.75 }}>{logFile.name}</span>}
            <button
              disabled={loading}
              onClick={() => submitPost('log')}
              style={{
                ...primaryButtonStyle,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '送信中…' : '投稿する'}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: '#b00020', marginTop: 12 }}>{error}</p>}

      {/* ✅ iPhone対応：confirm代替モーダル */}
      {confirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setConfirmTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#fff',
              borderRadius: 14,
              padding: 14,
              border: '1px solid rgba(0,0,0,0.10)',
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>投稿を取り消しますか？</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
              取り消すと元に戻せません。
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                disabled={deleting}
                onClick={() => setConfirmTarget(null)}
                style={smallButtonStyle}
              >
                キャンセル
              </button>

              <button
                disabled={deleting}
                onClick={() => executeDeletePost(confirmTarget.postId)}
                style={{
                  ...smallButtonStyle,
                  background: '#111',
                  color: '#fff',
                  borderColor: '#111',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? '処理中…' : '取り消す'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}