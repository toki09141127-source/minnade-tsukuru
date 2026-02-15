'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function PendingCoreBadge() {
  const [count, setCount] = useState<number>(0)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/notifications/pending-core-count', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setCount(json.count ?? 0)
    }
    load()
    const t = setInterval(load, 15000) // 15秒ごと更新（雑に最短）
    return () => clearInterval(t)
  }, [])

  return (
    <Link href="/rooms" className="relative inline-flex items-center gap-2">
      <span>申請</span>
      {count > 0 && (
        <span className="absolute -top-2 -right-3 rounded-full bg-red-600 text-white text-xs px-2 py-0.5">
          {count}
        </span>
      )}
    </Link>
  )
}
