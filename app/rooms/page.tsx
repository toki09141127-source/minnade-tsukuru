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
  // ↓ カラムが無い環境もあるので optional にする
  is_hidden?: boolean
  deleted_at?: string | null
}

type SortMode = 'likes' | 'new'

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [error, setError] = useState('')
  const [sort, setSort] = useState<SortMode>('likes')
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false

    const fetchRooms = async () => {
      setError('')

      // まずは「is_hidden / deleted_at が存在する前提」のクエリを試す
      const runWithHidden = async () => {
        let query = supabase
          .from('rooms')
          .select('id, title, work_type, status, time_limit_hours, created_at, like_count, is_hidden, deleted_at')
          .eq('is_hidden', false)
          .is('deleted_at', null)

        if (q.trim()) {
          query = query.ilike('title', `%${q.trim()}%`)
        }

        if (sort === 'likes') {
          query = query.order('like_count', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
        } else {
          query = query.order('created_at', { ascending: false })
        }

        return query
      }

      // 次に「is_hidden / deleted_at が無い環境でも動く」クエリ
      const runWithoutHidden = async () => {
        let query = supabase
          .from('rooms')
          .select('id, title, work_type, status, time_limit_hours, created_at, like_count')

        if (q.trim()) {
          query = query.ilike('title', `%${q.trim()}%`)
        }

        if (sort === 'likes') {
          query = query.order('like_count', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
        } else {
          query = query.order('created_at', { ascending: false })
        }

        return query
      }

      // 実行：まず hidden ありを試す → ダメなら fallback
      const { data, error } = await (await runWithHidden())

      if (cancelled) return

      if (error) {
        // 「column rooms.is_hidden does not exist」「column rooms.deleted_at does not exist」などで落ちてる時
        const msg = error.message ?? ''
        const isMissingColumn =
          msg.includes('does not exist') ||
          msg.includes('column') ||
          msg.includes('missing')

        if (isMissingColumn) {
          const res2 = await (await runWithoutHidden())
          if (cancelled) return
          if (res2.error) {
            setError(res2.error.message)
            setRooms([])
            return
          }
          setRooms((res2.data ?? []) as RoomRow[])
          return
        }

        // それ以外のエラーはそのまま表示
        setError(error.message)
        setRooms([])
        return
      }

      setRooms((data ?? []) as RoomRow[])
    }

    fetchRooms()

    return () => {
      cancelled = true
    }
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
        時間制限付きの合作ルーム一覧です。
        <br />
        「いいね順 / 新しい順」で並べ替えできます。タイトル検索もできます。
      </div>
    )
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <h1>制作ルーム一覧</h1>

      {/* ✅ ユーザー名導線 */}
      <p style={{ marginTop: 8 }}>
        <Link href="/profile">ユーザー名を設定</Link>
      </p>

      {helpText}

      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ルーム名で検索"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.15)',
            minWidth: 240,
          }}
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.15)',
          }}
        >
          <option value="likes">いいね順</option>
          <option value="new">新しい順</option>
        </select>

        <Link href="/rooms/new">＋ ルームを作成</Link>
      </div>

      {error && <p style={{ color: '#b00020', marginTop: 12 }}>{error}</p>}

      <ul style={{ marginTop: 12 }}>
        {rooms.map((room) => (
          <li key={room.id} style={{ marginBottom: 10 }}>
            <Link href={`/rooms/${room.id}`} prefetch={false}>
              <strong>{room.title}</strong>
            </Link>{' '}
            （{room.work_type} / {room.time_limit_hours}h / {room.status} / ❤️ {room.like_count ?? 0}）
          </li>
        ))}
      </ul>

      {!error && rooms.length === 0 && <p style={{ marginTop: 12, opacity: 0.7 }}>該当するルームがありません。</p>}
    </div>
  )
}
