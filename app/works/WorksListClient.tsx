'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

const CATEGORY_OPTIONS = ['全カテゴリー', '小説', '漫画', 'アニメ', 'ゲーム', 'イラスト', '音楽', '動画', 'その他'] as const

type WorkRow = {
  id: string
  title: string
  status: string
  ended_at?: string | null
  expires_at?: string | null
  is_adult?: boolean | null
  category?: string | null
  like_count?: number | null
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

export default function WorksListClient() {
  const [rows, setRows] = useState<WorkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('全カテゴリー')
  const [adult, setAdult] = useState<'all' | 'general' | 'adult'>('all')

  useEffect(() => {
    const run = async () => {
      setLoading(true)

      // rooms_with_counts がある場合はそこから（category等が揃ってる前提）
      const tryView = await supabase
        .from('rooms_with_counts')
        .select('id,title,status,ended_at,expires_at,is_adult,category,like_count')
        .eq('is_hidden', false)
        .in('status', ['forced_publish', 'closed', 'done'])
        .order('expires_at', { ascending: false })

      if (!tryView.error) {
        setRows((tryView.data as any[]) ?? [])
        setLoading(false)
        return
      }

      // view が無い/壊れてる場合は rooms から最低限（category無い環境でも落ちない）
      const r = await supabase
        .from('rooms')
        .select('id,title,status,ended_at,expires_at,is_adult,like_count')
        .eq('is_hidden', false)
        .in('status', ['forced_publish', 'closed', 'done'])
        .order('expires_at', { ascending: false })

      setRows(((r.data as any[]) ?? []) as WorkRow[])
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
          placeholder="検索（タイトル）"
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
          <p style={{ margin: 0, fontWeight: 900 }}>まだ完成作品がありません</p>
          <p style={{ margin: '6px 0 0', opacity: 0.8, fontSize: 13 }}>
            forced_publish が走っているのに出ない場合は、一覧の取得元（view/rooms）を次で確認します。
          </p>
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
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/works/${r.id}`}
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
                <Badge>{r.status}</Badge>
                {typeof r.like_count === 'number' && <Badge>♥ {r.like_count}</Badge>}
              </div>

              <div style={{ marginTop: 10, fontWeight: 950, fontSize: 16, lineHeight: 1.35 }}>
                {r.title}
              </div>

              <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                {r.expires_at ? `期限：${new Date(r.expires_at).toLocaleString()}` : '期限：—'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
