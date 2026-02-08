// app/components/LogoutButton.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const onLogout = async () => {
    if (loading) return
    setLoading(true)

    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (res.redirected) {
        window.location.href = res.url
        return
      }
      router.push('/rooms')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={onLogout}
      disabled={loading}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #ddd',
        background: '#fff',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 14,
      }}
    >
      {loading ? 'ログアウト中…' : 'ログアウト'}
    </button>
  )
}
