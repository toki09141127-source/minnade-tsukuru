// app/rooms/page.tsx
import Link from 'next/link'
import { supabaseAdmin } from '../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

type SortKey = 'likes' | 'new'

function clampSort(v: string | null): SortKey {
  return v === 'new' ? 'new' : 'likes'
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string }
}) {
  const qRaw = (searchParams?.q ?? '').trim()
  const q = qRaw.slice(0, 60) // 念のため長さ制限
  const sort = clampSort(searchParams?.sort ?? null)

  // ---- query builder ----
  let query = supabaseAdmin
    .from('rooms')
    .select('id, title, work_type, status, time_limit_hours, created_at, expires_at, like_count')

  // 検索（タイトル部分一致。大文字小文字はDB設定に依存）
  if (q) {
    // 例: title ILIKE '%abc%' になる
    query = query.ilike('title', `%${q}%`)
  }

  // 並び替え
  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('like_count', { ascending: false }).order('created_at', { ascending: false })
  }

  const { data: rooms, error } = await query.limit(200)

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>制作ルーム一覧</h1>
        <p style={{ color: 'crimson' }}>取得エラー: {error.message}</p>
        <p>
          <Link href="/">トップへ</Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>制作ルーム一覧</h1>

      {/* controls */}
      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <span style={{ marginRight: 8 }}>並び替え：</span>
          <Link
            href={`/rooms?sort=likes${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            style={{
              marginRight: 10,
              fontWeight: sort === 'likes' ? 'bold' : 'normal',
              textDecoration: sort === 'likes' ? 'underline' : 'none',
            }}
          >
            いいね順
          </Link>
          <Link
            href={`/rooms?sort=new${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            style={{
              fontWeight: sort === 'new' ? 'bold' : 'normal',
              textDecoration: sort === 'new' ? 'underline' : 'none',
            }}
          >
            作成順（新しい）
          </Link>
        </div>

        <form action="/rooms" method="get" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="hidden" name="sort" value={sort} />
          <input
            name="q"
            defaultValue={q}
            placeholder="ルーム名で検索（部分一致）"
            style={{ padding: '6px 10px', width: 280 }}
          />
          <button type="submit" style={{ padding: '6px 10px' }}>
            検索
          </button>
          {q && (
            <Link href={`/rooms?sort=${sort}`} style={{ marginLeft: 6 }}>
              クリア
            </Link>
          )}
        </form>
      </div>

      <p style={{ marginTop: 16 }}>
        <Link href="/rooms/new">＋ ルームを作成</Link>
      </p>

      <div style={{ marginTop: 16 }}>
        {rooms?.length ? (
          <ul style={{ paddingLeft: 18 }}>
            {rooms.map((r) => (
              <li key={r.id} style={{ marginBottom: 10 }}>
                <Link href={`/rooms/${r.id}`} style={{ fontWeight: 'bold' }}>
                  {r.title}
                </Link>{' '}
                <span style={{ opacity: 0.8 }}>
                  （{r.work_type} / {r.time_limit_hours}h / {r.status} / ❤️ {r.like_count ?? 0}）
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ marginTop: 18 }}>{q ? '該当するルームが見つかりません。' : 'ルームがありません。'}</p>
        )}
      </div>
    </div>
  )
}
