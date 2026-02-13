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
  attachment_url?: string | null   // Storage path を入れる
  attachment_type?: string | null  // mime を入れる
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

  // 添付（log / final）
  const [logFile, setLogFile] = useState<File | null>(null)
  const [finalFile, setFinalFile] = useState<File | null>(null)

  // signed url cache: postId -> signedUrl
  const [signedMap, setSignedMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      setUserId(data.user?.id ?? null)
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
      .select('id, user_id, username, content, created_at, post_type, deleted_at, attachment_url, attachment_type')
      .eq('room_id', roomId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    const rows = (data ?? []) as PostRow[]
    setPosts(rows)

    // 添付がある投稿の signed url を取りに行く（未取得分だけ）
    const need = rows.filter((p) => p.attachment_url && !signedMap[p.id])
    if (need.length === 0) return

    const token = await getToken()
    if (!token) return

    // 並列でsign（失敗しても一覧は壊さない）
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
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
    const text = type === 'log' ? content.trim() : finalContent.trim()
    const file = type === 'log' ? logFile : finalFile

    if (!text && !file) {
      alert('本文か画像のどちらかを入力してください')
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
        content: text || '(画像のみ)',
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

  const deletePost = async (postId: string) => {
    if (!confirm('投稿を取り消しますか？')) return

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

    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? '削除失敗')
      return
    }

    await fetchPosts()
  }

  const finalPosts = posts.filter((p) => p.post_type === 'final')
  const logPosts = posts.filter((p) => !p.post_type || p.post_type === 'log')

  const renderAttachment = (p: PostRow) => {
    const mime = (p.attachment_type ?? '').toLowerCase()
    const signedUrl = signedMap[p.id]
    if (!p.attachment_url) return null

    // 画像のみ対応（Phase3）
    if (!mime.startsWith('image/')) {
      return (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          添付ファイル（未対応形式）：{mime || 'unknown'}
        </div>
      )
    }

    if (!signedUrl) {
      return <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>画像を読み込み中…</div>
    }

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

  return (
    <section style={{ marginTop: 18 }}>
      <h2>完成作品（最終提出）</h2>

      {finalPosts.length === 0 ? (
        <p style={{ color: '#666' }}>まだ最終提出がありません。</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {finalPosts.map((p) => (
            <div key={p.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong>{p.username ?? '名無し'}</strong>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{new Date(p.created_at).toLocaleString()}</span>
              </div>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{p.content}</div>
              {renderAttachment(p)}
              {p.user_id === userId && (
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => deletePost(p.id)}>取り消し</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {roomStatus === 'open' && (
        <div style={{ marginTop: 12, border: '1px solid rgba(0,0,0,0.10)', borderRadius: 12, padding: 12, background: '#fafafa' }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>最終提出を投稿</div>

          <textarea
            value={finalContent}
            onChange={(e) => setFinalContent(e.target.value)}
            placeholder="最終提出を書く…（画像のみでもOK）"
            style={{ width: '100%', minHeight: 90, padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.18)' }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFinalFile(e.target.files?.[0] ?? null)}
            />
            {finalFile && <span style={{ fontSize: 12, opacity: 0.75 }}>{finalFile.name}</span>}
            <button disabled={loading} onClick={() => submitPost('final')}>
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
            <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong>{p.username ?? '名無し'}</strong>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{new Date(p.created_at).toLocaleString()}</span>
              </div>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{p.content}</div>
              {renderAttachment(p)}
              {p.user_id === userId && (
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => deletePost(p.id)}>取り消し</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {roomStatus === 'open' && (
        <div style={{ marginTop: 12, border: '1px solid rgba(0,0,0,0.10)', borderRadius: 12, padding: 12, background: '#fafafa' }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>制作ログを投稿</div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="制作ログを書く…（画像のみでもOK）"
            style={{ width: '100%', minHeight: 90, padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.18)' }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogFile(e.target.files?.[0] ?? null)}
            />
            {logFile && <span style={{ fontSize: 12, opacity: 0.75 }}>{logFile.name}</span>}
            <button disabled={loading} onClick={() => submitPost('log')}>
              {loading ? '送信中…' : '投稿する'}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: '#b00020', marginTop: 12 }}>{error}</p>}
    </section>
  )
}
