'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function LikeButton({ roomId }: { roomId: string }) {
  const [liked, setLiked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return
      const { data } = await supabase
        .from('room_likes')
        .select('room_id')
        .eq('room_id', roomId)
        .eq('user_id', uid)
        .maybeSingle()
      setLiked(!!data)
    }
    init()
  }, [roomId])

  const toggle = async () => {
    setMsg('')
    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setMsg('ログインしてください')
        return
      }

      const res = await fetch('/api/rooms/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      })
      const json = await res.json()
      if (!json.ok) {
        setMsg(json.error ?? '失敗')
        return
      }
      setLiked(json.liked === true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={loading}
        style={{
          padding: '10px 14px',
          border: '1px solid #111',
          borderRadius: 8,
          cursor: 'pointer',
          background: liked ? '#fff' : '#111',
          color: liked ? '#111' : '#fff',
        }}
      >
        {liked ? '❤️ 済み' : '♡ いいね'}
      </button>
      {msg && <div style={{ marginTop: 6, fontSize: 12, color: '#b00020' }}>{msg}</div>}
    </div>
  )
}
