// app/rooms/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
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
  expires_at?: string | null
}

type SortKey = 'like' | 'new' | 'expires'

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [error, setError] = useState('')
  const [sort, setSort] = useState<SortKey>('like')
  const [q, setQ] = useState('')

  useEffect(() => {
    const fetchRooms = async () => {
      setError('')

      let query = supabase
        .from('rooms')
        .select('id, title, work_type, status, time_limit_hours, created_at, like_count, expires_at')

      // 検索（タイトル部分一致）
      const keyword = q.trim()
      if (keyword) query = query.ilike('title', `%${keyword}%`)

      // ソート
      if (sort === 'like') {
        query = query
          .order('like_count', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
      } else if (sort === 'new') {
        query = query.order('created_at', { ascending: false })
      } else if (sort === 'expires') {
        query = query.order('expires_at', { ascending: true, nullsFirst: false })
      }

      const { data, error } = await query

      if (error) setError(error.message)
      else setRooms((data ?? []) as RoomRow[])
    }

    fetchRooms()
  }, [sort, q])

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
        時間制限付きの合作ルーム一覧です。検索＆並び替えができます。
      </div>
    )
  }, [])

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <h1>制作ルーム一覧</h1>

      <p style={{ marginTop: 8 }}>
        <Link href="/profile">ユーザー名を設定</Link>
      </p>

      {helpText}

      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <Link href="/rooms/new">＋ ルームを作成</Link>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>並び替え</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #ccc' }}
          >
            <option value="like">いいね順</option>
            <option value="new">新着順</option>
            <option value="expires">期限が近い順</option>
          </select>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ルーム名で検索"
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid #ccc',
            minWidth: 220,
          }}
        />
      </div>

      {error && <p style={{ color: '#b00020', marginTop: 10 }}>{error}</p>}

      <ul style={{ marginTop: 12, paddingLeft: 18 }}>
        {rooms.map((room) => (
          <li key={room.id} style={{ marginBottom: 10 }}>
            <Link href={`/rooms/${room.id}`}>
              <strong>{room.title}</strong>
            </Link>{' '}
            （{room.work_type} / {room.time_limit_hours}h / {room.status} / ❤️ {room.like_count ?? 0}）
          </li>
        ))}
      </ul>
    </div>
  )
}
