'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function PostForm(props: {
  roomId: string
  onPosted: () => Promise<void> | void
}) {
  const { roomId, onPosted } = props

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setErr(null)
    const text = content.trim()
    if (!text) return
    if (text.length > 2000) {
      setErr('2000文字以内でお願いします')
      return
    }

    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setErr('ログインが必要です')
        return
      }

      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, content: text }),
      })

      const json = await res.json()
      if (!res.ok || !json.ok) {
        setErr(json.error ?? '投稿に失敗しました')
        return
      }

      setContent('')
      await onPosted()
    } catch (e: any) {
      setErr(e?.message ?? '投稿に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="進捗・アイデア・相談・感想など、気軽に書いてOK！"
        rows={4}
        style={{ width: '100%', padding: 10 }}
        disabled={loading}
      />
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={submit} disabled={loading || !content.trim()}>
          {loading ? '投稿中...' : '投稿'}
        </button>
        {err && <span style={{ color: 'crimson' }}>{err}</span>}
      </div>
    </div>
  )
}
