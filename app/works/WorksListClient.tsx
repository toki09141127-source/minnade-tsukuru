'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type RoomRow = {
  id: string
  title: string
  status: string
  type: string | null
  category: string | null
  is_adult: boolean | null
  created_at: string
  expires_at: string | null
  like_count: number | null
  member_count: number | null
  is_hidden: boolean | null
  deleted_at: string | null
}

const CATEGORY_OPTIONS = [
  '全カテゴリー',
  '小説',
  '漫画',
  'アニメ',
  'イラスト',
  'ゲーム',
  '企画',
  '雑談',
  '音楽',
  '動画',
  'その他',
] as const

type CategoryOption = (typeof CATEGORY_OPTIONS)[number]
type SortKey = 'like' | 'new'

function badgeStyle(bg: string, fg: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: bg,
    color: fg,
    border: '1px solid rgba(0,0,0,0.06)',
  }
}

export default function WorksListClient() {
  const supabase = useMemo(() => createClient(), [])

  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [category, setCategory] = useState<CategoryOption>('全カテゴリー')
  const [adultOnly, setAdultOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('like')

  useEffect(() => {
    const fetchWorks = async () => {
      setLoading(true)
      setError('')

      const base = supabase
        .from('rooms_with_counts_v2')
        .select(
          'id, title, status, type, category, is_adult, created_at, expires_at, like_count, member_count, is_hidden, deleted_at'
        )
        .eq('status', 'forced_publish')
        .eq('is_hidden', false)
        .is('deleted_at', null)

      const query =
        sort === 'like'
          ? base
              .order('like_count', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false })
          : base.order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        setError(error.message)
        setRooms([])
      } else {
        setRooms((data ?? []) as RoomRow[])
      }

      setLoading(false)
    }

    fetchWorks()
  }, [supabase, sort])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()

    return rooms.filter((r) => {
      if (adultOnly && !r.is_adult) return false

      if (category !== '全カテゴリー') {
        const c = (r.category ?? r.type ?? '').trim()
        if (c !== category) return false
      }

      if (query) {
        const title = (r.title ?? '').toLowerCase()
        if (!title.includes(query)) return false
      }

      return true
    })
  }, [rooms, q, category, adultOnly])

  return (
    <div style={{ marginTop: 14 }}>
      {/* Controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 10,
          padding: 14,
          border: '1px solid rgba(0,0,0,0.10)',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.85)',
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="作品（ルーム）名で検索…"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.18)',
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryOption)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.18)',
              background: '#fff',
            }}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.18)',
              background: '#fff',
            }}
          >
            <option value="like">いいね順</option>
            <option value="new">新着順</option>
          </select>
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'center', userSelect: 'none' }}>
          <input type="checkbox" checked={adultOnly} onChange={(e) => setAdultOnly(e.target.checked)} />
          <span style={{ fontWeight: 800 }}>成人向けのみ表示</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>（閲覧は自己責任）</span>
        </label>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
        表示：<b>{filtered.length}</b> / {rooms.length}
      </div>

      {loading && <p style={{ marginTop: 12, opacity: 0.7 }}>読み込み中…</p>}
      {error && <p style={{ marginTop: 12, color: '#b00020' }}>{error}</p>}

      {/* Cards */}
      <div
        style={{
          marginTop: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {filtered.map((r) => {
          const cat = (r.category ?? r.type ?? 'その他').trim() || 'その他'
          const isAdult = Boolean(r.is_adult)
          const memberCount = r.member_count ?? 0
          const likes = r.like_count ?? 0

          return (
            <Link
              key={r.id}
              href={`/works/${r.id}`}
              prefetch={false}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                style={{
                  border: '1px solid rgba(0,0,0,0.10)',
                  borderRadius: 18,
                  padding: 14,
                  background: 'rgba(255,255,255,0.9)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={badgeStyle('rgba(59,130,246,0.14)', '#1e40af')}>公開済み</span>
                  <span style={badgeStyle('rgba(0,0,0,0.06)', '#111')}>{cat}</span>
                  {isAdult && <span style={badgeStyle('rgba(239,68,68,0.14)', '#7f1d1d')}>成人向け</span>}
                </div>

                <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900, lineHeight: 1.3 }}>
                  {r.title}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    fontSize: 13,
                    opacity: 0.85,
                  }}
                >
                  <div>👥 参加者：{memberCount}</div>
                  <div>❤️ いいね：{likes}</div>
                  <div>🕒 公開：{new Date(r.created_at).toLocaleDateString()}</div>
                  <div>🔗 詳細へ</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {!loading && !error && filtered.length === 0 && (
        <p style={{ marginTop: 14, opacity: 0.75 }}>該当する作品がありません。</p>
      )}
    </div>
  )
}
