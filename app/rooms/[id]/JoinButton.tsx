// app/rooms/[id]/JoinButton.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function JoinButton({
  roomId,
  roomStatus,
  onJoined,
}: {
  roomId: string
  roomStatus: string
  onJoined?: () => void
}) {
  const router = useRouter()

  const [joined, setJoined] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ✅ 初期化：参加済みならボタンを「参加済み」にする
  useEffect(() => {
    const init = async () => {
      setError('')
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return

      const { data, error } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('room_id', roomId)
        .eq('user_id', uid)
        .is('left_at', null) // left_at がある前提（復帰済みなら null）
        .maybeSingle()

      if (!error) setJoined(!!data)
    }

    init()
  }, [roomId])

  const join = async () => {
    // 参加済みなら何もしない
    if (joined) return

    if (roomStatus !== 'open') return
    setLoading(true)
    setError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setError('Not authenticated（ログインしてください）')
        return
      }

      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) {
        setError(json?.error ?? '参加に失敗しました')
        return
      }

      // ✅ 参加済みに切り替え
      setJoined(json?.joined === false ? false : true)

      // ✅（推奨）親側の状態更新
      onJoined?.()

      // ✅（最重要）Server Componentを再評価して BoardClient を即表示
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? '参加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || roomStatus !== 'open' || joined

  return (
    <div>
      <button
        onClick={join}
        disabled={disabled}
        style={{
          padding: '10px 16px',
          borderRadius: 10,
          border: '1px solid #111',
          background: joined ? '#fff' : '#111',
          color: joined ? '#111' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.7 : 1,
          fontWeight: 800,
        }}
      >
        {loading ? '参加中…' : joined ? '参加済み' : '参加する'}
      </button>

      {error && <p style={{ color: '#b00020', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
