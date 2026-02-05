'use client'

import { useEffect, useMemo, useState } from 'react'

function formatMs(ms: number) {
  if (ms <= 0) return '終了'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}h ${m}m ${s}s`
}

export default function RemainingTimer({ expiresAt }: { expiresAt: string | null }) {
  const target = useMemo(() => {
    if (!expiresAt) return null
    const t = new Date(expiresAt).getTime()
    return Number.isFinite(t) ? t : null
  }, [expiresAt])

  const [label, setLabel] = useState(() => {
    if (!target) return '（期限未設定）'
    return formatMs(target - Date.now())
  })

  useEffect(() => {
    if (!target) return

    const id = setInterval(() => {
      setLabel(formatMs(target - Date.now()))
    }, 1000)

    return () => clearInterval(id)
  }, [target])

  return <span>{label}</span>
}
