// app/rooms/RoomsListClient.tsx
'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type RoomRow = {
  id: string
  title: string | null
  kind: string | null
  status: string
  created_at: string
  expires_at: string | null
  member_count: number
  is_adult: boolean | null
}

function formatRemaining(ms: number) {
  if (ms <= 0) return '終了'
  const s = Math.floor(ms / 1000)
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`
}

function Remaining({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())

  // 1秒ごと更新（軽量）
  useMemo(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!expiresAt) return <span className="muted">—</span>
  const end = new Date(expiresAt).getTime()
  return <span className="badge">{formatRemaining(end - now)}</span>
}

export default function RoomsListClient({ initialRooms }: { initialRooms: RoomRow[] }) {
  const [q, setQ] = useState('')
  const [adult, setAdult] = useState<'safe' | 'all' | 'adult'>('safe')
  const [status, setStatus] = useState<'all' | 'open' | 'closed' | 'published'>('all')

  const filtered = useMemo(() => {
    return initialRooms.filter((r) => {
      const text = `${r.title ?? ''} ${r.kind ?? ''}`.toLowerCase()
      const okQ = !q.trim() || text.includes(q.trim().toLowerCase())
      const okStatus = status === 'all' || r.status === status
      const isAdult = !!r.is_adult

      const okAdult =
        adult === 'all' ? true :
        adult === 'adult' ? isAdult :
        !isAdult

      return okQ && okStatus && okAdult
    })
  }, [initialRooms, q, adult, status])

  return (
    <div className="stack">
      <div className="toolbar">
        <input
          className="input"
          placeholder="検索（タイトル/カテゴリ）"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">全ステータス</option>
          <option value="open">open</option>
          <option value="closed">closed</option>
          <option value="published">published</option>
        </select>

        <select className="select" value={adult} onChange={(e) => setAdult(e.target.value as any)}>
          <option value="safe">一般のみ</option>
          <option value="adult">成人のみ</option>
          <option value="all">全部</option>
        </select>
      </div>

      <div className="grid">
        {filtered.map((r) => (
          <Link key={r.id} href={`/rooms/${r.id}`} className="card linkCard">
            <div className="row">
              <div className="title">{r.title ?? '（無題）'}</div>
              {r.is_adult ? <span className="badge danger">成人</span> : <span className="badge ok">一般</span>}
            </div>

            <div className="muted">カテゴリ: {r.kind ?? '—'} / status: {r.status}</div>

            <div className="row" style={{ marginTop: 10 }}>
              <div className="muted">参加: <b>{r.member_count}</b> 人</div>
              <div className="muted">残り: <Remaining expiresAt={r.expires_at} /></div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <div className="card">該当するルームがありません</div>}
    </div>
  )
}
