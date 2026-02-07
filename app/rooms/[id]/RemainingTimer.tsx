// app/rooms/[id]/RemainingTimer.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'

export default function RemainingTimer(props: {
  expiresAt: string | null
  status: string
}) {
  const { expiresAt, status } = props
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const label = useMemo(() => {
    if (status !== 'open') return '⏱ 終了'
    if (!expiresAt) return '⏱ 期限なし'

    const end = new Date(expiresAt).getTime()
    const diff = end - now
    if (diff <= 0) return '⏱ 終了'

    const sec = Math.floor(diff / 1000)
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `⏱ 残り ${h}時間 ${m}分 ${s}秒`
  }, [expiresAt, now, status])

  return (
    <div style={{ fontSize: 13, opacity: 0.85 }}>
      {label}
    </div>
  )
}
