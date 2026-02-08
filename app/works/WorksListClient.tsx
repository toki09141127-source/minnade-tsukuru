// app/works/WorksListClient.tsx
'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type RoomRow = {
  id: string
  title: string | null
  kind: string | null
  status: string
  created_at: string
  member_count: number
  is_adult: boolean | null
}

export default function WorksListClient({ initialRooms }: { initialRooms: RoomRow[] }) {
  const [q, setQ] = useState('')
  const [adult, setAdult] = useState<'safe' | 'all' | 'adult'>('safe')
  const [kind, setKind] = useState<string>('all')

  const kinds = useMemo(() => {
    const s = new Set<string>()
    for (const r of initialRooms) if (r.kind) s.add(r.kind)
    return ['all', ...Array.from(s)]
  }, [initialRooms])

  const filtered = useMemo(() => {
    return initialRooms.filter((r) => {
      const text = `${r.title ?? ''} ${r.kind ?? ''}`.toLowerCase()
      const okQ = !q.trim() || text.includes(q.trim().toLowerCase())
      const isAdult = !!r.is_adult
      const okAdult =
        adult === 'all' ? true :
        adult === 'adult' ? isAdult :
        !isAdult
      const okKind = kind === 'all' || (r.kind ?? '') === kind
      return okQ && okAdult && okKind
    })
  }, [initialRooms, q, adult, kind])

  return (
    <div className="stack">
      <div className="toolbar">
        <input className="input" placeholder="検索（タイトル/カテゴリ）" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
          {kinds.map((k) => (
            <option key={k} value={k}>{k === 'all' ? '全カテゴリ' : k}</option>
          ))}
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
            <div className="muted">カテゴリ: {r.kind ?? '—'} / 参加: {r.member_count} 人</div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <div className="card">該当する作品がありません</div>}
    </div>
  )
}
