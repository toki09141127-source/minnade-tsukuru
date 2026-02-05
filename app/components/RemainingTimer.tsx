'use client'

import { useEffect, useMemo, useState } from 'react'

function formatMs(ms: number) {
  if (ms <= 0) return '終了'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

export default function RemainingTimer({
  expiresAt,
}: {
  expiresAt: string | null
}) {
  const expiresMs = useMemo(() => {
    if (!expiresAt) return null
    const t = new Date(expiresAt).getTime()
    return Number.isFinite(t) ? t : null
  }, [expiresAt])

  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!expiresMs) return <span>（期限未設定）</span>

  const diff = expiresMs - now
  return <span>{formatMs(diff)}</span>
}
