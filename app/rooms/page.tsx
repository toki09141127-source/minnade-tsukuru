import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { RoomCard } from '../../components/RoomCard'

const CATEGORY_OPTIONS = ['all','小説','漫画','アニメ','ゲーム','イラスト','音楽','動画','その他'] as const
const ADULT_OPTIONS = ['all','general','adult'] as const

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; adult?: string }
}) {
  const q = (searchParams.q ?? '').trim()
  const category = (searchParams.category ?? 'all').trim()
  const adult = (searchParams.adult ?? 'all').trim()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } })

  let query = supabase
    .from('rooms_with_counts')
    .select('id,title,type,status,category,is_adult,expires_at,member_count,like_count,created_at')
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (category !== 'all') query = query.eq('category', category)
  if (adult === 'adult') query = query.eq('is_adult', true)
  if (adult === 'general') query = query.eq('is_adult', false)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data: rooms, error } = await query

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>制作ルーム一覧</h1>
          <p style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>
            参加人数・残り時間を見ながら、勢いのあるルームに飛び込める。
          </p>
        </div>

        <Link
          href="/rooms/create"
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: 'var(--btn)',
            color: 'var(--btnfg)',
            fontWeight: 900,
            textDecoration: 'none',
            border: '1px solid rgba(0,0,0,.14)',
          }}
        >
          ＋ ルーム作成
        </Link>
      </div>

      {/* 検索/フィルタ */}
      <form
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: '1fr 200px 200px',
          gap: 10,
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="タイトル検索…"
          style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(0,0,0,.14)', background: 'var(--panel)', color: 'var(--fg)' }}
        />

        <select
          name="category"
          defaultValue={category}
          style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(0,0,0,.14)', background: 'var(--panel)', color: 'var(--fg)' }}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? '全カテゴリー' : c}
            </option>
          ))}
        </select>

        <select
          name="adult"
          defaultValue={adult}
          style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(0,0,0,.14)', background: 'var(--panel)', color: 'var(--fg)' }}
        >
          {ADULT_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a === 'all' ? '全年齢/成人向け' : a === 'general' ? '全年齢のみ' : '成人向けのみ'}
            </option>
          ))}
        </select>

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
          <button
            type="submit"
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--btn)',
              color: 'var(--btnfg)',
              fontWeight: 900,
              border: '1px solid rgba(0,0,0,.14)',
              cursor: 'pointer',
            }}
          >
            絞り込む
          </button>
          <Link href="/rooms" style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: 13 }}>
            リセット
          </Link>
        </div>
      </form>

      {error && <p style={{ color: '#b00020', marginTop: 12 }}>{error.message}</p>}

      {/* カードグリッド */}
      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {(rooms ?? []).map((r: any) => (
          <RoomCard key={r.id} room={r} mode="rooms" />
        ))}
      </div>

      {!rooms?.length && (
        <div style={{ marginTop: 18, padding: 16, borderRadius: 16, background: 'var(--panel)', border: '1px solid rgba(0,0,0,.10)' }}>
          <b>まだルームがありません。</b>
          <div style={{ marginTop: 6, color: 'var(--muted)' }}>右上の「ルーム作成」から始めよう。</div>
        </div>
      )}
    </div>
  )
}
