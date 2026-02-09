'use client'

import Link from 'next/link'

function badgeStyle(bg: string, fg: string) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: bg,
    color: fg,
  } as const
}

function formatRemaining(expiresAt: string) {
  const t = new Date(expiresAt).getTime()
  const now = Date.now()
  const diff = Math.max(0, t - now)
  const totalSec = Math.floor(diff / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}h ${m}m ${s}s`
}

export function RoomCard({
  room,
  mode,
}: {
  room: {
    id: string
    title: string
    type: string
    status: string
    category: string
    is_adult: boolean
    expires_at: string
    member_count?: number | null
    like_count?: number | null
    created_at?: string | null
  }
  mode: 'rooms' | 'works'
}) {
  const isOpen = room.status === 'open'
  const statusLabel =
    room.status === 'open' ? '制作中' : room.status === 'forced_publish' ? '完成（自動公開）' : room.status

  const statusBadge = isOpen
    ? badgeStyle('rgba(16,185,129,.18)', 'rgb(16,185,129)')
    : badgeStyle('rgba(59,130,246,.18)', 'rgb(59,130,246)')

  const adultBadge = room.is_adult ? badgeStyle('rgba(244,63,94,.18)', 'rgb(244,63,94)') : null

  return (
    <div
      style={{
        border: '1px solid rgba(0,0,0,.08)',
        borderRadius: 16,
        padding: 14,
        background: 'var(--panel)',
        boxShadow: '0 8px 24px rgba(0,0,0,.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={statusBadge}>{statusLabel}</span>
          <span style={badgeStyle('rgba(0,0,0,.06)', 'var(--fg)')}>{room.category || 'その他'}</span>
          {adultBadge && <span style={adultBadge}>成人向け</span>}
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          ♥ {room.like_count ?? 0}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35, color: 'var(--fg)' }}>
          {room.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          type: {room.type} / 参加者: {room.member_count ?? 0}人
        </div>
      </div>

      <div
        style={{
          marginTop: 2,
          padding: '10px 12px',
          borderRadius: 12,
          background: 'rgba(0,0,0,.04)',
          border: '1px solid rgba(0,0,0,.06)',
          color: 'var(--fg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700 }}>
          {isOpen ? '残り時間' : '期限'}
        </div>
        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 800 }}>
          {room.expires_at ? formatRemaining(room.expires_at) : '-'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
        <Link
          href={mode === 'rooms' ? `/rooms/${room.id}` : `/works/${room.id}`}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,.14)',
            background: 'var(--btn)',
            color: 'var(--btnfg)',
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          {mode === 'rooms' ? 'ルーム詳細' : '作品を見る'}
        </Link>
      </div>
    </div>
  )
}
