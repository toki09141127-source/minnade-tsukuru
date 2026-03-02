'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase/client'
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

// ✅ 未読キャッシュ（RoomsListClientと同じキー）
const UNREAD_CACHE_KEY = 'unread_map_v1'
const UNREAD_CACHE_TTL_MS = 30_000

export default function WorksListClient(props: { initialUnreadMap?: Record<string, number> }) {
  const supabase = useMemo(() => createClient(), [])

  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ✅ SSRで即表示
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>(props.initialUnreadMap ?? {})

  const [q, setQ] = useState('')
  const [category, setCategory] = useState<CategoryOption>('全カテゴリー')
  const [adultOnly, setAdultOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('like')
  const [aiFilter, setAiFilter] = useState<AiFilter>('all')

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.18)',
    background: '#fff',
    fontWeight: 400,
  }

  // ✅ キャッシュ復元（あれば優先）→なければSSR値をキャッシュ化
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(UNREAD_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { ts: number; map: Record<string, number> }
        if (parsed?.ts && parsed?.map && Date.now() - parsed.ts <= UNREAD_CACHE_TTL_MS) {
          setUnreadMap(parsed.map)
          return
        }
      }

      sessionStorage.setItem(
        UNREAD_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), map: props.initialUnreadMap ?? {} })
      )
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const fetchWorks = async () => {
      setLoading(true)
      setError('')

      // -------------------------
      // ✅ unread-map を裏で更新（roomsを待たない）
      // -------------------------
      const fetchUnread = async () => {
        try {
          const { data: u } = await supabase.auth.getUser()
          const user = u.user
          if (!user) {
            setUnreadMap({})
            try {
              sessionStorage.removeItem(UNREAD_CACHE_KEY)
            } catch {}
            return
          }

          const { data: sess } = await supabase.auth.getSession()
          const token = sess.session?.access_token
          if (!token) {
            setUnreadMap({})
            try {
              sessionStorage.removeItem(UNREAD_CACHE_KEY)
            } catch {}
            return
          }

          const res = await fetch('/api/rooms/unread-map?excludeSelf=1', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          })
          const json = await res.json().catch(() => ({}))

          if (!res.ok) {
            console.error('[unread-map]', json)
            setUnreadMap({})
            try {
              sessionStorage.removeItem(UNREAD_CACHE_KEY)
            } catch {}
            return
          }

          const map = (json?.map ?? {}) as Record<string, number>
          setUnreadMap(map)

          try {
            sessionStorage.setItem(UNREAD_CACHE_KEY, JSON.stringify({ ts: Date.now(), map }))
          } catch {}
        } catch (e) {
          console.error('[unread-map] fetch failed', e)
          // SSR/キャッシュ表示を維持
        }
      }

      // -------------------------
      // ✅ works一覧（既存）
      // -------------------------
      const fetchWorksList = async () => {
        const base = supabase
          .from('rooms_with_counts_v2')
          .select(
            'id, title, status, type, category, is_adult, created_at, expires_at, like_count, member_count, is_hidden, deleted_at, ai_level'
          )
          .eq('status', 'forced_publish')
          .eq('is_hidden', false)
          .is('deleted_at', null)

        const query =
          sort === 'like'
            ? base.order('like_count', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
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

      // ✅ 並列実行
      void fetchUnread()
      await fetchWorksList()
    }

    fetchWorks()
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

      if (aiFilter !== 'all') {
        const lv = normalizeAiLevel(r.ai_level, 'assist')
        if (lv !== aiFilter) return false
      }

      if (query) {
        const title = (r.title ?? '').toLowerCase()
        if (!title.includes(query)) return false
      }

      return true
    })
  }, [roomsWithUnread, q, category, adultOnly, aiFilter])

  return (
    <div style={{ marginTop: 14 }}>
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryOption)} style={selectStyle}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select value={aiFilter} onChange={(e) => setAiFilter(e.target.value as AiFilter)} style={selectStyle}>
            <option value="all">AI：全て</option>
            {AI_LEVEL_OPTIONS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>

          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={selectStyle}>
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
          const memberCount = r.member_count ?? 0
          const likes = r.like_count ?? 0
          const unread = r.unread_count ?? 0

          return (
            <Link key={r.id} href={`/works/${r.id}`} prefetch={false} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div
                style={{
                  position: 'relative',
                  border: '1px solid rgba(0,0,0,0.10)',
                  borderRadius: 18,
                  padding: 14,
                  background: 'rgba(255,255,255,0.9)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                }}
              >
                {/* ✅ 作品一覧でも即時未読 */}
                {unread > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      minWidth: 22,
                      height: 22,
                      padding: '0 7px',
                      borderRadius: 999,
                      background: '#d32f2f',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
                    }}
                    aria-label={`未読 ${unread} 件`}
                    title={`未読 ${unread} 件`}
                  >
                    {unread > 99 ? '99+' : unread}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {statusBadge(r.status)}
                  {categoryBadge(cat)}
                  {aiBadge(r.ai_level)}
                  {adultBadge(r.is_adult)}
                </div>

                <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900, lineHeight: 1.3 }}>{r.title}</div>

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

      {!loading && !error && filtered.length === 0 && <p style={{ marginTop: 14, opacity: 0.75 }}>該当する作品がありません。</p>}
    </div>
  )
}