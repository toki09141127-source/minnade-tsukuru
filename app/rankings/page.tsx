// app/rankings/page.tsx
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
  deleted_at?: string | null
}

export const dynamic = 'force-dynamic'

export default async function RankingsPage() {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, title, work_type, status, time_limit_hours, created_at, like_count, is_hidden, deleted_at')
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .order('like_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div style={{ padding: 24 }}>
      <Link href="/">← トップへ</Link>
      <h1 style={{ marginTop: 10 }}>いいねランキング</h1>

      {error && <p style={{ color: '#b00020' }}>{error.message}</p>}

      <ol style={{ marginTop: 12, paddingLeft: 18 }}>
        {(data ?? []).map((r) => (
          <li key={r.id} style={{ marginBottom: 10 }}>
            <Link href={`/rooms/${r.id}`} prefetch={false}>
              <strong>{r.title}</strong>
            </Link>
            <span style={{ marginLeft: 8, color: '#444', fontSize: 14 }}>
              ❤️ {r.like_count ?? 0} / {r.work_type} / {r.time_limit_hours}h / {r.status}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
