'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function JoinButton({
  roomId,
  roomStatus,
}: {
  roomId: string
  roomStatus: string
}) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const join = async () => {
    setMsg('')
    if (roomStatus !== 'open') {
      setMsg('このルームは現在参加できません')
      return
    }

    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setMsg('ログインしてください')
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
        setMsg(json.error ?? '参加失敗')
        return
      }

      setMsg('参加しました！ページを更新してください（F5）')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={join}
        disabled={loading}
        style={{
          padding: '10px 14px',
          border: '1px solid #111',
          borderRadius: 8,
          cursor: 'pointer',
          background: '#111',
          color: '#fff',
        }}
      >
        {loading ? '参加中…' : '参加する'}
      </button>
      {msg && <p style={{ marginTop: 8, color: msg.includes('参加しました') ? '#0b6' : '#b00020' }}>{msg}</p>}
    </div>
  )
}
