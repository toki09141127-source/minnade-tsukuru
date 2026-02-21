'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
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

type SortKey = 'like' | 'new'
type StatusFilter = 'all' | 'open' | 'forced_publish'

function badgeStyle(bg: string, fg: string): React.CSSProperties {
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

function unreadBadgeStyle(): React.CSSProperties {
  return {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 28,
    height: 22,
    padding: '0 8px',
    borderRadius: 999,
    background: '#111',
    color: '#fff',
    fontSize: 12,
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 18px rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.15)',
    lineHeight: 1,
  }
}

export default function RoomsListClient() {
  const supabase = createClient()

  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('全カテゴリー')
  const [adultOnly, setAdultOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('like')

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // ✅ 未読マップ（roomId -> count）
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
  // ✅ 自分が参加中のroom集合（Realtimeの増分フィルタに使う）
  const [memberRoomSet, setMemberRoomSet] = useState<Set<string>>(new Set())
  // ✅ 自分のuserId
  const [userId, setUserId] = useState<string | null>(null)

  // -----------------------------------------
  // 1) userId 取得
  // -----------------------------------------
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      setUserId(data.user?.id ?? null)
    }
    init()
  }, [supabase])

  // -----------------------------------------
  // 2) rooms を取得
  // -----------------------------------------
  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true)
      setError('')

      let base = supabase
        .from('rooms_with_counts_v2')
        .select(
          'id, title, status, type, category, is_adult, created_at, expires_at, like_count, member_count, is_hidden, deleted_at'
        )
        .eq('is_hidden', false)
        .is('deleted_at', null)

      if (statusFilter === 'open') {
        base = base.eq('status', 'open')
      } else if (statusFilter === 'forced_publish') {
        base = base.eq('status', 'forced_publish')
      } else {
        base = base.in('status', ['open', 'forced_publish'])
      }

      const sorted =
        sort === 'like'
          ? base.order('like_count', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
          : base.order('created_at', { ascending: false })

      const { data, error } = await sorted

      if (error) setError(error.message)
      else setRooms((data ?? []) as RoomRow[])

      setLoading(false)
    }

    fetchRooms()
  }, [sort, statusFilter, supabase])

  // -----------------------------------------
  // 3) 初期未読を RPC で取得（ログイン時のみ）
  //    unreadMap + memberRoomSet を構築
  // -----------------------------------------
  const loadUnread = useCallback(async () => {
    if (!userId) {
      setUnreadMap({})
      setMemberRoomSet(new Set())
      return
    }

    const { data, error } = await supabase.rpc('unread_counts_for_me')
    if (error) {
      // 未読は失敗しても一覧表示は壊さない
      return
    }

    const map: Record<string, number> = {}
    const set = new Set<string>()

    ;(data ?? []).forEach((row: any) => {
      const rid = String(row.room_id)
      const cnt = Number(row.unread_count ?? 0)
      map[rid] = cnt
      set.add(rid)
    })

    setUnreadMap(map)
    setMemberRoomSet(set)
  }, [supabase, userId])

  useEffect(() => {
    loadUnread()
  }, [loadUnread])

  // -----------------------------------------
  // 4) Realtime: posts INSERT を拾って unread を増やす
  //    条件：deleted_at null / 自分の投稿は除外 / 参加中roomのみ加算
  // -----------------------------------------
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('realtime-unread-posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          const post = payload.new as any
          if (!post) return

          // deleted_at は INSERT 時点では通常 null 想定だが保険
          if (post.deleted_at) return

          // 自分の投稿は未読に含めない
          if (String(post.user_id) === String(userId)) return

          const rid = String(post.room_id ?? '')
          if (!rid) return

          // 自分が参加中のルームだけ増やす（不要な通知を排除）
          if (!memberRoomSet.has(rid)) return

          setUnreadMap((prev) => {
            const next = { ...prev }
            next[rid] = (next[rid] ?? 0) + 1
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, memberRoomSet])

  // -----------------------------------------
  // UI側フィルタ
  // -----------------------------------------
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
          placeholder="ルーム名で検索…"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.18)',
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.18)',
              background: '#fff',
            }}
          >
            <option value="all">公開中＋公開済み</option>
            <option value="open">open（公開中）</option>
            <option value="forced_publish">forced_publish（公開済み）</option>
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
          const isAdult = Boolean(r.is_adult)
          const memberCount = r.member_count ?? 0
          const likes = r.like_count ?? 0

          const statusBadge =
            r.status === 'open'
              ? { bg: 'rgba(16,185,129,0.14)', fg: '#065f46', label: 'open' }
              : { bg: 'rgba(59,130,246,0.14)', fg: '#1e40af', label: 'forced_publish' }

          const unread = unreadMap[r.id] ?? 0

          return (
            <Link key={r.id} href={`/rooms/${r.id}`} prefetch={false} style={{ textDecoration: 'none', color: 'inherit' }}>
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
                {/* ✅ 未読バッジ */}
                {unread > 0 && <span style={unreadBadgeStyle()}>{unread > 99 ? '99+' : unread}</span>}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={badgeStyle(statusBadge.bg, statusBadge.fg)}>{statusBadge.label}</span>
                  <span style={badgeStyle('rgba(0,0,0,0.06)', '#111')}>{cat}</span>
                  {isAdult && <span style={badgeStyle('rgba(239,68,68,0.14)', '#7f1d1d')}>成人向け</span>}
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
                  <div>🕒 作成：{new Date(r.created_at).toLocaleDateString()}</div>
                  <div>🔗 詳細へ</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {!loading && !error && filtered.length === 0 && <p style={{ marginTop: 14, opacity: 0.75 }}>該当するルームがありません。</p>}
    </div>
  )
}