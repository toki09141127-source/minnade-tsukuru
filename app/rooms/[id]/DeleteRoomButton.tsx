// app/rooms/[id]/DeleteRoomButton.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

export default function DeleteRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onDelete = async () => {
    if (!confirm('このルームを削除しますか？（投稿・参加者も削除されます）')) return
    setError('')
    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setError('ログインしてください')
        return
      }

      const res = await fetch('/api/rooms/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      })

      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? '削除に失敗しました')
        return
      }

      router.push('/rooms')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <button
        onClick={onDelete}
        disabled={loading}
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #b00020',
          background: 'transparent',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '削除中…' : 'このルームを削除（ホストのみ）'}
      </button>
      {error && <p style={{ color: '#b00020', margin: 0 }}>{error}</p>}
    </div>
  )
}
