// app/rooms/[id]/PostFormClient.tsx
'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function PostFormClient({
  roomId,
  roomStatus,
}: {
  roomId: string
  roomStatus: string
}) {
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const uploadIfNeeded = async (): Promise<{ url?: string; type?: string }> => {
    if (!file) return {}

    // 画像/動画/zip/pdf あたりを許可（必要なら増やす）
    const allowed = [
      'image/png','image/jpeg','image/webp','image/gif',
      'video/mp4','video/webm',
      'application/pdf',
      'application/zip'
    ]
    if (!allowed.includes(file.type)) {
      throw new Error(`未対応のファイル形式です: ${file.type}`)
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) throw new Error('Not authenticated')

    const ext = file.name.split('.').pop() || 'bin'
    const path = `${roomId}/${userId}/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('attachments')
      .upload(path, file, { upsert: false, contentType: file.type })

    if (upErr) throw new Error(upErr.message)

    const { data } = supabase.storage.from('attachments').getPublicUrl(path)
    return { url: data.publicUrl, type: file.type }
  }

  const submit = async () => {
    if (loading) return
    if (roomStatus !== 'open') {
      setError('このルームは open ではありません')
      return
    }

    const trimmed = content.trim()
    if (!trimmed && !file) return

    setLoading(true)
    setError('')
    setInfo('投稿中…')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setError('Not authenticated')
        return
      }

      // ① 先にアップロード（必要なら）
      const att = await uploadIfNeeded()

      // ② サーバRouteへ（DB insertはサーバだけ）
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId,
          content: trimmed || '(添付ファイル)',
          attachment_url: att.url ?? null,
          attachment_type: att.type ?? null,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? `投稿に失敗しました (status=${res.status})`)
        return
      }

      setContent('')
      setFile(null)
      setInfo('投稿しました。更新します…')
      window.location.reload()
    } catch (e: any) {
      setError(e?.message ?? '投稿に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="投稿内容…（ファイルだけでもOK）"
        style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
      />

      <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && <span style={{ fontSize: 12, color: '#555' }}>{file.name}</span>}
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={submit}
          disabled={loading || roomStatus !== 'open'}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
            cursor: loading || roomStatus !== 'open' ? 'not-allowed' : 'pointer',
            opacity: loading || roomStatus !== 'open' ? 0.6 : 1,
          }}
        >
          {loading ? '送信中…' : '投稿する'}
        </button>

        {info && <span style={{ fontSize: 12, color: '#555' }}>{info}</span>}
      </div>

      {error && <p style={{ color: '#b00020', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
