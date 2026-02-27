'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { statusBadge, categoryBadge, aiBadge, adultBadge } from '@/app/components/RoomBadges'
import { AI_LEVEL_OPTIONS, normalizeAiLevel, type AiLevel } from '@/lib/aiLevel'

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
  ai_level: string | null
  unread_count?: number
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
type AiFilter = 'all' | AiLevel
type StatusFilter = 'all' | 'open' | 'forced_publish'

export default function RoomsListClient() {
  const supabase = useMemo(() => createClient(), [])

  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})

  const [q, setQ] = useState('')
  const [category, setCategory] = useState<CategoryOption>('全カテゴリー')
  const [adultOnly, setAdultOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('new')
  const [aiFilter, setAiFilter] = useState<AiFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.18)',
    background: '#fff',
    fontWeight: 400,
  }

  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true)
      setError('')

      const base = supabase
        .from('rooms_with_counts_v2')
        .select(
          'id, title, status, type, category, is_adult, created_at, expires_at, like_count, member_count, is_hidden, deleted_at, ai_level'
        )
        .eq('is_hidden', false)
        .is('deleted_at', null)

      const query =
        sort === 'like'
          ? base.order('like_count', { ascending: false }).order('created_at', { ascending: false })
          : base.order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        setError(error.message)
        setRooms([])
        setUnreadMap({})
        setLoading(false)
        return
      }

      const list = (data ?? []) as RoomRow[]
      setRooms(list)

      // 未読取得
      const { data: u } = await supabase.auth.getUser()
      const user = u.user
      if (!user) {
        setUnreadMap({})
        setLoading(false)
        return
      }

      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) {
        setUnreadMap({})
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/rooms/unread-map?excludeSelf=1', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          setUnreadMap(json?.map ?? {})
        } else {
          setUnreadMap({})
        }
      } catch {
        setUnreadMap({})
      }

      setLoading(false)
    }

    fetchRooms()
  }, [supabase, sort])

  const roomsWithUnread = useMemo(() => {
    return rooms.map((r) => ({
      ...r,
      unread_count: unreadMap[r.id] ?? 0,
    }))
  }, [rooms, unreadMap])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()

    return roomsWithUnread.filter((r) => {
      if (adultOnly && !r.is_adult) return false
      if (category !== '全カテゴリー') {
        const c = (r.category ?? r.type ?? '').trim()
        if (c !== category) return false
      }
      if (statusFilter !== 'all') {
        if ((r.status ?? '').trim() !== statusFilter) return false
      }
      if (aiFilter !== 'all') {
        const lv = normalizeAiLevel(r.ai_level, 'assist')
        if (lv !== aiFilter) return false
      }
      if (query && !(r.title ?? '').toLowerCase().includes(query)) return false
      return true
    })
  }, [roomsWithUnread, q, category, adultOnly, aiFilter, statusFilter])

  return (
    <div style={{ marginTop: 14 }}>
      {/* フィルタボックス */}
      <div
        style={{
          display: 'grid',
          gap: 12,
          padding: 16,
          border: '1px solid rgba(0,0,0,0.10)',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.95)',
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ルーム名で検索…"
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.18)',
          }}
        />

        {/* レスポンシブフィルタ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>カテゴリー</div>
            <select value={category} onChange={(e) => setCategory(e.target.value as CategoryOption)} style={selectStyle}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>ステータス</div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={selectStyle}>
              <option value="all">制作中＋公開済み</option>
              <option value="open">制作中</option>
              <option value="forced_publish">公開済み</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>AIレベル</div>
            <select value={aiFilter} onChange={(e) => setAiFilter(e.target.value as AiFilter)} style={selectStyle}>
              <option value="all">全て</option>
              {AI_LEVEL_OPTIONS.map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>並び替え</div>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={selectStyle}>
              <option value="new">新着順</option>
              <option value="like">いいね順</option>
            </select>
          </div>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={adultOnly} onChange={(e) => setAdultOnly(e.target.checked)} />
          <span style={{ fontWeight: 600 }}>成人向けのみ表示</span>
        </label>
      </div>

      {/* 一覧 */}
      <div style={{ marginTop: 14, fontSize: 13, opacity: 0.75 }}>
        表示：<b>{filtered.length}</b> / {rooms.length}
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        {filtered.map((r) => {
          const unread = r.unread_count ?? 0
          return (
            <Link key={r.id} href={`/rooms/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div
                style={{
                  position: 'relative',
                  border: '1px solid rgba(0,0,0,0.10)',
                  borderRadius: 18,
                  padding: 16,
                  background: '#fff',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
                }}
              >
                {unread > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      minWidth: 24,
                      height: 24,
                      borderRadius: 999,
                      background: '#d32f2f',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {unread > 99 ? '99+' : unread}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {statusBadge(r.status)}
                  {categoryBadge(r.category ?? r.type ?? 'その他')}
                  {aiBadge(r.ai_level)}
                  {adultBadge(r.is_adult)}
                </div>

                <div style={{ marginTop: 12, fontSize: 17, fontWeight: 800 }}>{r.title}</div>

                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                  👥 {r.member_count ?? 0} ｜ ❤️ {r.like_count ?? 0}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}