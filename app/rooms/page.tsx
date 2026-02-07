// app/rooms/page.tsx
import Link from 'next/link'
import { supabaseAdmin } from '../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

type SortKey = 'likes' | 'new'

export default async function RoomsPage({
  searchParams,
}: {
  searchParams?: { q?: string; sort?: SortKey }
}) {
  const q = (searchParams?.q ?? '').trim()
  const sort: SortKey = (searchParams?.sort === 'new' ? 'new' : 'likes')

  // ✅ 必ず id を取る。deleted_at も見る。
  let query = supabaseAdmin
    .from('rooms')
    .select('id, title, work_type, status, time_limit_hours, like_count, created_at, deleted_at, is_adult')
    .is('deleted_at', null)

  if (q) query = query.ilike('title', `%${q}%`)

  if (sort === 'new') query = query.order('created_at', { ascending: false })
  else query = query.order('like_count', { ascending: false }).order('created_at', { ascending: false })

  const { data: rooms, error } = await query

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>制作ルーム一覧</h1>
        <p style={{ color: 'crimson' }}>取得エラー: {error.message}</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/">トップへ</Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>制作ルーム一覧</h1>

      {/* 検索・並び替え */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <form action="/rooms" method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="ルーム名で検索"
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)', minWidth: 240 }}
          />
          <select
            name="sort"
            defaultValue={sort}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          >
            <option value="likes">いいね順</option>
            <option value="new">作成順（新しい順）</option>
          </select>
          <button
            type="submit"
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)', cursor: 'pointer' }}
          >
            検索
          </button>
        </form>

        <Link href="/rooms/new" style={{ marginLeft: 'auto' }}>
          ＋ ルームを作成
        </Link>
      </div>

      <div style={{ marginTop: 16 }}>
        {(rooms ?? []).length === 0 ? (
          <p style={{ opacity: 0.8 }}>該当するルームがありません。</p>
        ) : (
          <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
            {(rooms ?? []).map((r) => (
              <li key={r.id}>
                {/* ✅ ここが超重要：/rooms/${r.id} であること */}
                <Link href={`/rooms/${r.id}`} style={{ fontWeight: 700 }}>
                  {r.title}
                </Link>{' '}
                <span style={{ opacity: 0.85 }}>
                  （{r.work_type} / {r.time_limit_hours}h / {r.status} / ❤️ {r.like_count ?? 0}
                  {r.is_adult ? ' / 🔞' : ''}）
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
