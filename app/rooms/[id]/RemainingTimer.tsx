'use client'

import { useEffect, useMemo, useState } from 'react'

export default function RemainingTimer({ expiresAt }: { expiresAt: string | null }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 250)
    return () => clearInterval(t)
  }, [])

  const text = useMemo(() => {
    if (!expiresAt) return '⏳ 期限未設定'
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (ms <= 0) return '⏳ 終了'
    const s = Math.floor(ms / 1000)
    return `⏳ 残り ${s}s`
  }, [expiresAt, tick])

  return <div style={{ fontSize: 14, color: '#333' }}>{text}</div>
}
