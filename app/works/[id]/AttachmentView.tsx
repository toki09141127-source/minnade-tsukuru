'use client'

import { useEffect, useState } from 'react'

export default function AttachmentView({
  path,
  mime,
}: {
  path: string | null | undefined
  mime: string | null | undefined
}) {
  const [url, setUrl] = useState<string>('')
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    const run = async () => {
      setErr('')
      setUrl('')

      const p = (path ?? '').trim()
      if (!p) return

      try {
        const res = await fetch('/api/storage/sign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: p }),
        })

        const json = (await res.json().catch(() => ({}))) as any
        if (!res.ok) {
          setErr(json?.error ?? '署名URLの取得に失敗しました')
          return
        }

        const signedUrl = String(json?.signedUrl ?? json?.url ?? '')
        if (!signedUrl) {
          setErr('署名URLが空です')
          return
        }

        setUrl(signedUrl)
      } catch (e: any) {
        setErr(e?.message ?? '署名URLの取得に失敗しました')
      }
    }

    run()
  }, [path])

  const m = (mime ?? '').toLowerCase()
  const isImage = m.startsWith('image/')

  if (!path) return null

  if (err) {
    return (
      <div style={{ marginTop: 10, fontSize: 12, color: '#b00020' }}>
        添付の表示に失敗：{err}
      </div>
    )
  }

  if (!url) {
    return <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>添付を読み込み中…</div>
  }

  if (isImage) {
    return (
      <div style={{ marginTop: 10 }}>
        <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
          <img
            src={url}
            alt="attachment"
            style={{
              width: '100%',
              maxWidth: 760,
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.10)',
              display: 'block',
            }}
            loading="lazy"
          />
        </a>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          画像をクリックすると別タブで開きます
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10 }}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-block',
          padding: '8px 10px',
          borderRadius: 10,
          border: '1px solid rgba(0,0,0,0.12)',
          textDecoration: 'none',
          color: '#111',
          fontWeight: 800,
          background: 'rgba(255,255,255,0.9)',
        }}
      >
        添付ファイルを開く
      </a>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>種類：{mime ?? '-'}</div>
    </div>
  )
}