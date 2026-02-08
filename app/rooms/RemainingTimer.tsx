// app/rooms/RemainingTimer.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'

export default function RemainingTimer({ expiresAt }: { expiresAt: string }) {
  const end = useMemo(() => new Date(expiresAt).getTime(), [expiresAt])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const diff = Math.max(0, end - now)
  const sec = Math.floor(diff / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60

  return (
    <span className="muted">
      残り {h}時間 {m}分 {s}秒
    </span>
  )
}
