// app/rooms/[id]/JoinButton.tsx
'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function JoinButton({
  roomId,
  roomStatus,
  onJoined,
}: {
  roomId: string
  roomStatus: string
  onJoined?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const join = async () => {
    if (roomStatus !== 'open') return
    setLoading(true)
    setError('')

    try {
      // ✅ クライアントでアクセストークン取得（Cookieに頼らない）
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) {
        setError(sessErr.message)
        return
      }
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setError('Not authenticated')
        return
      }

      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ roomId }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(json?.error ?? '参加に失敗しました')
      } else {
        onJoined?.()
      }
    } catch (e: any) {
      setError(e?.message ?? '参加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={join}
        disabled={loading || roomStatus !== 'open'}
        style={{
          padding: '10px 16px',
          borderRadius: 10,
          border: '1px solid #111',
          background: '#111',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        {loading ? '参加中…' : '参加する'}
      </button>

      {error && <p style={{ color: '#b00020', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
