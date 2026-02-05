// app/rooms/[id]/JoinButton.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

export default function JoinButton({
  roomId,
  roomStatus,
}: {
  roomId: string
  roomStatus: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)
  const [username, setUsername] = useState<string>('')

  const canJoin = useMemo(() => roomStatus === 'open' && !loading, [roomStatus, loading])

  useEffect(() => {
    const init = async () => {
      setError('')

      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return

      // username確認（profiles）
      const { data: prof } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle()
      setUsername((prof?.username ?? '').trim())

      // 参加済み確認
      const { data: mem } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', uid)
        .maybeSingle()
      setJoined(!!mem)
    }
    init()
  }, [roomId])

  const join = async () => {
    setError('')

    if (roomStatus !== 'open') {
      setError('このルームは現在参加できません')
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) {
      setError('ログインしてください')
      return
    }

    // ✅ username未設定なら profile へ
    if (!username.trim()) {
      router.push('/profile')
      return
    }

    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setError('ログインしてください')
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

      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? '参加に失敗しました')
        return
      }

      setJoined(true)
      // 表示更新用にリロード
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {joined ? (
        <div style={{ fontSize: 13, color: '#0b6' }}>参加済み</div>
      ) : (
        <button
          onClick={join}
          disabled={!canJoin}
          style={{
            padding: '10px 14px',
            border: '1px solid #111',
            borderRadius: 10,
            cursor: canJoin ? 'pointer' : 'not-allowed',
            background: '#111',
            color: '#fff',
            opacity: canJoin ? 1 : 0.5,
          }}
        >
          {loading ? '参加中…' : '参加する'}
        </button>
      )}

      {!username.trim() && (
        <p style={{ marginTop: 6, fontSize: 12, color: '#b00020' }}>
          参加するには <a href="/profile">ユーザー名を設定</a> してください。
        </p>
      )}

      {error && <p style={{ marginTop: 6, color: '#b00020' }}>{error}</p>}
    </div>
  )
}
