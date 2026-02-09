'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

const CATEGORY_OPTIONS = ['全カテゴリー', '小説', '漫画', 'アニメ', 'ゲーム', 'イラスト', '音楽', '動画', 'その他'] as const

type RoomRow = {
  id: string
  title: string
  status: string
  expires_at: string | null
  started_at: string | null
  is_adult?: boolean | null
  category?: string | null
  member_count?: number | null
  like_count?: number | null
}

function msLeft(iso: string | null) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  const now = Date.now()
  return Math.max(0, t - now)
}

function fmtRemain(ms: number) {
  const total = Math.floor(ms / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return `${d}日${h}時間${m}分`
  if (h > 0) return `${h}時間${m}分`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

function Badge({ children }: { children: any }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 900,
        padding: '4px 8px',
        borderRadius: 999,
        border: '1px solid rgba(0,0,0,0.16)',
        background: 'rgba(0,0,0,0.04)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export default function RoomsListClient() {
  const [rows, setRows] = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('全カテゴリー')
  const [adult, setAdult] = useState<'all' | 'general' | 'adult'>('all')
  const [, forceTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => forceTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const run = async () => {
      setLoading(true)

      // できるだけ壊れにくいように：rooms_with_counts があれば優先、なければ rooms
      // rooms_with_counts: id,title,status,expires_at,started_at,is_adult,category,member_count,like_count を想定
      let data: any[] | null = null

      const tryView = await supabase
        .from('rooms_with_counts')
        .select('id,title,status,expires_at,started_at,is_adult,category,member_count,like_count')
        .eq('is_hidden', false)
        .eq('status', 'open')
        .order('expires_at', { ascending: true })

      if (!tryView.error) data = tryView.data as any[]
      if (!data) {
        const r = await supabase
          .from('rooms')
          .select('id,title,status,expires_at,started_at,is_adult,like_count')
          .eq('is_hidden', false)
          .eq('status', 'open')
          .order('expires_at', { ascending: true })
        data = (r.data as any[]) ?? []
      }

      setRows(data as RoomRow[])
      setLoading(false)
    }
    run()
  }, [])

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (kw && !String(r.title ?? '').toLowerCase().includes(kw)) return false
      if (adult === 'general' && r.is_adult) return false
      if (adult === 'adult' && !r.is_adult) return false
      if (category !== '全カテゴリー') {
        // categoryがDBに無い環境でも落ちないようにガード
        if ((r.category ?? '') !== category) return false
      }
      return true
    })
  }, [rows, q, adult, category])

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 0.8fr 0.8fr',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="検索（例：ネーム / プロット / 企画）"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.18)',
          }}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.18)',
          }}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={adult}
          onChange={(e) => setAdult(e.target.value as any)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.18)',
          }}
        >
          <option value="all">対象：すべて</option>
          <option value="general">対象：一般向け</option>
          <option value="adult">対象：成人向け</option>
        </select>
      </div>

      {loading ? (
        <p style={{ marginTop: 14, opacity: 0.7 }}>読み込み中…</p>
      ) : filtered.length === 0 ? (
        <div style={{ marginTop: 16, border: '1px dashed rgba(0,0,0,0.2)', borderRadius: 16, padding: 16 }}>
          <p style={{ margin: 0, fontWeight: 900 }}>条件に一致するルームがありません</p>
          <p style={{ margin: '6px 0 0', opacity: 0.8, fontSize: 13 }}>検索条件を変えるか、新しくルームを作ってみよう。</p>
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {filtered.map((r) => {
            const left = msLeft(r.expires_at ?? null)
            const remain = left == null ? '—' : fmtRemain(left)
            return (
              <Link
                key={r.id}
                href={`/rooms/${r.id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 18,
                  padding: 14,
                  background: 'rgba(255,255,255,0.85)',
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {r.category ? <Badge>{r.category}</Badge> : <Badge>カテゴリ未設定</Badge>}
                  <Badge>{r.is_adult ? '成人向け' : '一般向け'}</Badge>
                  <Badge>残り：{remain}</Badge>
                  {typeof r.member_count === 'number' && <Badge>参加 {r.member_count}人</Badge>}
                </div>

                <div style={{ marginTop: 10, fontWeight: 950, fontSize: 16, lineHeight: 1.35 }}>
                  {r.title}
                </div>

                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', opacity: 0.8, fontSize: 12 }}>
                  <span>ステータス：{r.status}</span>
                  {typeof r.like_count === 'number' && <span>♥ {r.like_count}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
