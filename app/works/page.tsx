// app/works/page.tsx
import Link from 'next/link'
import { supabase } from '../../lib/supabase/client'

type RoomRow = {
  id: string
  title: string
  work_type: string
  status: string
  created_at: string
  like_count: number | null
  is_hidden: boolean
  deleted_at?: string | null
}

export const dynamic = 'force-dynamic'

export default async function WorksIndexPage() {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, title, work_type, status, created_at, like_count, is_hidden, deleted_at')
    .eq('status', 'forced_publish')
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div style={{ padding: 24 }}>
      <Link href="/">← トップへ</Link>
      <h1 style={{ marginTop: 10 }}>完成した作品（公開ルーム）</h1>

      {error && <p style={{ color: '#b00020' }}>{error.message}</p>}

      <ul style={{ marginTop: 12 }}>
        {(data ?? []).map((r) => (
          <li key={r.id} style={{ marginBottom: 10 }}>
            <Link href={`/works/${r.id}`} prefetch={false}>
              <strong>{r.title}</strong>
            </Link>
            <span style={{ marginLeft: 8, color: '#444', fontSize: 14 }}>
              ❤️ {r.like_count ?? 0} / {r.work_type}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
