// app/rooms/page.tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import RemainingTimer from './RemainingTimer'

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

type RoomRow = {
  id: string
  title: string
  status: string
  category: string
  is_adult: boolean
  expires_at: string | null
  like_count: number | null
  member_count: number | null
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: { category?: string; adult?: string }
}) {
  const category = searchParams.category ?? 'all'
  const adult = searchParams.adult ?? 'all' // all | general | adult

  const supabase = await createSupabaseServerClient()

  // open のみ（制作中）
  const { data, error } = await supabase
    .from('rooms_with_counts')
    .select('id,title,status,category,is_adult,expires_at,like_count,member_count')
    .eq('status', 'open')
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>制作ルーム一覧</h1>
        <p style={{ color: '#b00020' }}>{error.message}</p>
      </div>
    )
  }

  let rooms = (data ?? []) as RoomRow[]

  // カテゴリフィルタ
  if (category !== 'all') rooms = rooms.filter((r) => r.category === category)

  // 成人向けフィルタ
  if (adult === 'general') rooms = rooms.filter((r) => !r.is_adult)
  if (adult === 'adult') rooms = rooms.filter((r) => r.is_adult)

  return (
    <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>制作ルーム一覧</h1>
        <Link
          href="/rooms/create"
          style={{
            textDecoration: 'none',
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
            fontWeight: 800,
          }}
        >
          ＋ ルーム作成
        </Link>
      </div>

      {/* フィルタ */}
      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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

          <Link href="/rooms" style={{ marginLeft: 8, textDecoration: 'none', fontWeight: 700 }}>
            リセット
          </Link>
        </form>
      </div>

      {/* 一覧（見やすかった方の “カード縦並び” に戻す） */}
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
                  {r.category} / status: {r.status}
                  {r.is_adult ? ' / 🔞成人向け' : ''}
                  {' / '}❤ {r.like_count ?? 0}
                  {' / '}参加 {r.member_count ?? 0}人
                </div>
              </div>

              <div style={{ fontSize: 12, opacity: 0.9 }}>
                {r.expires_at ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⌛ 残り</span>
                    <RemainingTimer expiresAt={r.expires_at} />
                  </div>
                ) : (
                  <span>⌛ 残り時間：未設定</span>
                )}
              </div>
            </div>
          </Link>
        ))}

        {rooms.length === 0 && (
          <div style={{ padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.12)', opacity: 0.8 }}>
            該当するルームがありません。
          </div>
        )}
      </div>
    </div>
  )
}
