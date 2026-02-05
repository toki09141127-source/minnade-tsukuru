'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
import BackToRooms from '../BackToRooms'

export default function NewRoomPage() {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const createRoom = async () => {
    setError('')
    if (!title.trim()) return setError('タイトルを入力してください')

    setLoading(true)

    const { error } = await supabase.from('rooms').insert({
      title,
      work_type: 'story',
      status: 'open',
      time_limit_hours: 24,
    })

    setLoading(false)

    if (error) return setError(error.message)

    location.href = '/rooms'
  }

  return (
    <div style={{ padding: 24 }}>
      <BackToRooms />

      <h1 style={{ marginTop: 8 }}>ルーム作成</h1>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="タイトル"
        style={{
          marginTop: 12,
          padding: 10,
          width: 300,
          border: '1px solid #ccc',
          borderRadius: 8,
        }}
      />

      <div>
        <button
          onClick={createRoom}
          disabled={loading}
          style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {loading ? '作成中…' : '作成'}
        </button>
      </div>

      {error && <p style={{ color: '#b00020' }}>{error}</p>}
    </div>
  )
}
