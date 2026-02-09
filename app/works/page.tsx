// app/works/page.tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全カテゴリー' },
  { value: '小説', label: '小説' },
  { value: '漫画', label: '漫画' },
  { value: 'アニメ', label: 'アニメ' },
  { value: 'イラスト', label: 'イラスト' },
  { value: 'ゲーム', label: 'ゲーム' },
  { value: '企画', label: '企画' },
  { value: '雑談', label: '雑談' },
  { value: 'その他', label: 'その他' },
]

type Room = {
  id: string
  title: string
  status: string
  category: string
  is_adult: boolean
  created_at: string
  like_count: number | null
}

export default async function WorksPage({
  searchParams,
}: {
  searchParams: { category?: string; adult?: string; q?: string }
}) {
  const category = searchParams.category ?? 'all'
  const adult = searchParams.adult ?? 'all'
  const q = (searchParams.q ?? '').trim()

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('rooms')
    .select('id,title,status,category,is_adult,created_at,like_count')
    .eq('status', 'forced_publish')
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>完成作品</h1>
        <p style={{ color: '#b00020' }}>{error.message}</p>
      </div>
    )
  }

  let rooms = (data ?? []) as Room[]

  if (category !== 'all') rooms = rooms.filter((r) => r.category === category)
  if (adult === 'general') rooms = rooms.filter((r) => !r.is_adult)
  if (adult === 'adult') rooms = rooms.filter((r) => r.is_adult)
  if (q) rooms = rooms.filter((r) => (r.title ?? '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>完成作品</h1>
        <Link href="/rooms" style={{ textDecoration: 'none', fontWeight: 800 }}>
          制作ルーム一覧へ →
        </Link>
      </div>

      {/* フィルタ */}
      <div style={{ marginTop: 14 }}>
        <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontWeight: 700 }}>カテゴリ</label>
          <select name="category" defaultValue={category} style={{ padding: '8px 10px', borderRadius: 10 }}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <label style={{ fontWeight: 700 }}>対象</label>
          <select name="adult" defaultValue={adult} style={{ padding: '8px 10px', borderRadius: 10 }}>
            <option value="all">すべて</option>
            <option value="general">一般向け</option>
            <option value="adult">成人向け</option>
          </select>

          <label style={{ fontWeight: 700 }}>検索</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="タイトルで検索"
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.2)' }}
          />

          <button
            type="submit"
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.2)',
              background: 'rgba(255,255,255,0.9)',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            絞り込む
          </button>

          <Link href="/works" style={{ marginLeft: 8, textDecoration: 'none', fontWeight: 700 }}>
            リセット
          </Link>
        </form>
      </div>

      {/* 一覧：完成作品は「ルーム」単位で出す（作品ページへ） */}
      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {rooms.map((r) => (
          <Link
            key={r.id}
            href={`/rooms/${r.id}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 16,
              padding: 14,
              background: 'rgba(255,255,255,0.85)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{r.title}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                  {r.category} {r.is_adult ? ' / 🔞成人向け' : ''} / ❤ {r.like_count ?? 0}
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>公開済み</div>
            </div>
          </Link>
        ))}

        {rooms.length === 0 && (
          <div style={{ padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.12)', opacity: 0.8 }}>
            該当する完成作品がありません。
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
        ※ 完成作品ページは「ファイルだけ」ではなく、今は <b>ルーム単位</b>で一覧化しています（ルーム詳細へ飛べば投稿ログ/添付も見られます）。
      </div>
    </div>
  )
}
