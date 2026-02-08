// app/ranking/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase/client'

type RoomRow = {
  id: string
  title: string
  work_type: string
  status: string
  time_limit_hours: number
  created_at: string
  like_count: number | null
  is_hidden: boolean
  deleted_at: string | null
}

export default function RankingPage() {
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      setError('')
      const { data, error } = await supabase
        .from('rooms')
        .select('id, title, work_type, status, time_limit_hours, created_at, like_count, is_hidden, deleted_at')
        .eq('is_hidden', false)
        .is('deleted_at', null)
        .order('like_count', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) setError(error.message)
      else setRooms((data ?? []) as RoomRow[])
    }
    run()
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <h1>いいねランキング</h1>
      <p style={{ marginTop: 8, color: '#666' }}>
        今みんなが注目している制作ルーム（非表示・削除は除外）
      </p>

      <p style={{ marginTop: 12 }}>
        <Link href="/rooms">← ルーム一覧へ</Link>
      </p>

      {error && <p style={{ color: '#b00020' }}>{error}</p>}

      <ol style={{ marginTop: 16, paddingLeft: 20 }}>
        {rooms.map((r) => (
          <li key={r.id} style={{ marginBottom: 12 }}>
            <Link href={`/rooms/${r.id}`} prefetch={false}>
              <strong>{r.title}</strong>
            </Link>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              ❤️ {r.like_count ?? 0} / {r.work_type} / {r.time_limit_hours}h / {r.status}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
