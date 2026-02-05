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
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const join = async () => {
    setMsg('')
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

      setMsg(json.message ?? '参加しました。リロードしてください。')
    } finally {
      setLoading(false)
    }
  }

  const disabled = roomStatus !== 'open' || loading

  return (
    <div>
      <button
        onClick={join}
        disabled={disabled}
        style={{
          padding: '10px 14px',
          border: '1px solid #111',
          borderRadius: 8,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: disabled ? '#aaa' : '#111',
          color: '#fff',
        }}
      >
        {loading ? '参加中…' : '参加する'}
      </button>

      {msg && <div style={{ marginTop: 8, fontSize: 13, color: msg.includes('失') ? '#b00020' : '#0b6' }}>{msg}</div>}
    </div>
  )
}
