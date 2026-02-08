'use client'

import { useEffect, useState } from 'react'
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
  const [me, setMe] = useState<string>('checking...')

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      setMe(data.user?.id ? `logged-in: ${data.user.id}` : 'logged-out')
    }
    run()
  }, [])

  const join = async () => {
    if (roomStatus !== 'open') return
    setLoading(true)
    setError('')

    try {
      // app/rooms/[id]/JoinButton.tsx（join() の fetch 部分だけ差し替え）
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
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
      {/* デバッグ表示 */}
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>auth: {me}</p>

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
