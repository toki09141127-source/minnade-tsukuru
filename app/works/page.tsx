// app/works/page.tsx
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const CATEGORY_OPTIONS = ['全カテゴリー', '漫画', 'アニメ', '小説', 'イラスト', 'ゲーム', '脚本', '音楽', '映像', 'その他'] as const
const AUDIENCE_OPTIONS = [
  { value: 'all', label: '全対象' },
  { value: 'general', label: '一般向け' },
  { value: 'adult', label: '成人向け' },
] as const

export default async function WorksPage({
  searchParams,
}: {
  searchParams?: { category?: string; audience?: string; q?: string }
}) {
  const category = searchParams?.category ?? '全カテゴリー'
  const audience = searchParams?.audience ?? 'all'
  const q = (searchParams?.q ?? '').trim()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } })

  // 「完成作品」＝ rooms の status=published（またはclosed）を並べる想定
  let query = supabase
    .from('rooms')
    .select('id, title, category, audience, status, published_at, expires_at')
    .in('status', ['published', 'closed'])
    .order('published_at', { ascending: false, nullsFirst: false })

  if (category !== '全カテゴリー') query = query.eq('category', category)
  if (audience !== 'all') query = query.eq('audience', audience)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data: rooms, error } = await query

  return (
    <div className="container">
      <h1 className="h1">完成作品</h1>

      <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <select name="category" defaultValue={category} className="input">
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select name="audience" defaultValue={audience} className="input">
          {AUDIENCE_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        <input name="q" defaultValue={q} placeholder="検索（タイトル）" className="input" />

        <button className="btnGhost" type="submit">
          絞り込み
        </button>

        <Link className="btnGhost" href="/works">
          リセット
        </Link>
      </form>

      {error && <p style={{ color: '#b00020', marginTop: 10 }}>{error.message}</p>}

      <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        {(rooms ?? []).map((r: any) => (
          <Link key={r.id} href={`/works/${r.id}`} className="cardLink">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800 }}>{r.title}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {r.category ?? 'その他'} / {r.audience === 'adult' ? '成人向け' : '一般向け'}
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              status: {r.status}
            </div>
          </Link>
        ))}
        {(!rooms || rooms.length === 0) && <p className="mutedLine">該当する作品がありません。</p>}
      </div>
    </div>
  )
}
