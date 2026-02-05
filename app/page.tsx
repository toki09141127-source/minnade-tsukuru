'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase/client'

type RoomRow = {
  id: string
  title: string
  work_type: string
  status: string
  time_limit_hours: number
  created_at: string
  like_count: number | null
}

export default function HomePage() {
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchRooms = async () => {
      setError('')
      const { data, error } = await supabase
        .from('rooms')
        .select('id, title, work_type, status, time_limit_hours, created_at, like_count')
        .order('like_count', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) setError(error.message)
      else setRooms((data ?? []) as RoomRow[])
    }

    fetchRooms()
  }, [])

  const helpText = useMemo(() => {
    return (
      <div
        style={{
          marginTop: 12,
          padding: 14,
          background: '#eef3ff',
          borderRadius: 10,
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        <strong>このページについて</strong>
        <br />
        時間制限付きの合作ルーム一覧です。
        <br />
        いまは「いいね順」で表示しています。
      </div>
    )
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <h1>制作ルーム一覧</h1>

      {helpText}

      {/* ✅ ユーザー名設定導線（事故防止） */}
      <p style={{ marginTop: 8 }}>
        <Link href="/profile">ユーザー名を設定</Link>
      </p>

      <p style={{ marginTop: 12 }}>
        <Link href="/rooms/new">＋ ルームを作成</Link>
      </p>

      {error && <p style={{ color: '#b00020' }}>{error}</p>}

      <ul style={{ marginTop: 12 }}>
        {rooms.map((room) => (
          <li key={room.id} style={{ marginBottom: 10 }}>
            <Link href={`/rooms/${room.id}`}>
              <strong>{room.title}</strong>
            </Link>{' '}
            （{room.work_type} / {room.time_limit_hours}h / {room.status} / ❤️{' '}
            {room.like_count ?? 0}）
          </li>
        ))}
      </ul>
    </div>
  )
}
