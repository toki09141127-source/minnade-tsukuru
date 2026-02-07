// app/rooms/[id]/RemainingTimer.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'

type Props = {
  expiresAt: string | null
  status?: string
}

function format(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${hh}:${pad(mm)}:${pad(ss)}`
}

export default function RemainingTimer({ expiresAt, status }: Props) {
  const target = useMemo(() => (expiresAt ? new Date(expiresAt).getTime() : null), [expiresAt])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!expiresAt || !target) return <span>期限なし</span>

  // 公開済みはタイマーより状態を優先して見せる
  if (status === 'forced_publish') return <span>公開済み</span>

  const diff = target - now
  if (diff <= 0) return <span>期限切れ</span>

  return <span>残り {format(diff)}</span>
}
