'use client'

import { useEffect, useMemo, useState } from 'react'

type Props = {
  attachment_url?: string | null
  attachment_type?: string | null
}

function isImageAttachment(url: string, type: string) {
  // type が MIME の場合：image/jpeg, image/png など
  if (type.startsWith('image/')) return true
  if (type === 'image') return true // 旧互換

  // type が空でも拡張子で推定（保険）
  const u = url.toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(u)
}

export default function PostAttachment({ attachment_url, attachment_type }: Props) {
  const path = useMemo(() => (attachment_url ?? '').trim(), [attachment_url])
  const type = useMemo(() => (attachment_type ?? '').trim().toLowerCase(), [attachment_type])

  const [src, setSrc] = useState<string | null>(null)
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    let canceled = false

    const run = async () => {
      setErr('')
      setSrc(null)

      if (!path) return

      // 画像以外は表示しない（ただし type が空のケースは拡張子で推定）
      if (type && !isImageAttachment(path, type)) return
      if (!type && !isImageAttachment(path, '')) return

      const res = await fetch('/api/storage/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (!canceled) setErr(json?.error ?? 'failed to load image')
        return
      }
      if (!json?.signedUrl) return

      if (!canceled) setSrc(json.signedUrl)
    }

    run()
    return () => {
      canceled = true
    }
  }, [path, type])

  if (!path) return null
  if (type && !isImageAttachment(path, type)) return null
  if (!type && !isImageAttachment(path, '')) return null

  if (err) {
    return (
      <div style={{ marginTop: 10, fontSize: 12, color: '#b00020' }}>
        画像の読み込みに失敗しました：{err}
      </div>
    )
  }

  if (!src) return null

  return (
    <div style={{ marginTop: 10 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="attachment"
        loading="lazy"
        style={{
          width: '100%',
          maxWidth: 820,
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.10)',
          display: 'block',
        }}
      />
    </div>
  )
}