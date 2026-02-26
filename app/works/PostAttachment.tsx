'use client'

import { useEffect, useState } from 'react'

type Props = {
  attachment_url?: string | null
  attachment_type?: string | null
}

export default function PostAttachment({ attachment_url, attachment_type }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    let canceled = false

    const run = async () => {
      setErr('')
      setSrc(null)

      const path = (attachment_url ?? '').trim()
      const type = (attachment_type ?? '').trim()

      if (!path) return
      if (type && type !== 'image') return

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
  }, [attachment_url, attachment_type])

  if (!attachment_url) return null
  if (attachment_type && attachment_type !== 'image') return null

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