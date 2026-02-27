// app/components/RoomBadges.tsx
import type { CSSProperties } from 'react'
import { normalizeAiLevel, type AiLevel } from '@/lib/aiLevel'

export type RoomStatus = 'open' | 'forced_publish' | 'closed' | string

export function badgeStyle(bg: string, fg: string): CSSProperties {
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

export function statusLabel(status: RoomStatus) {
  const s = String(status ?? '').toLowerCase()
  if (s === 'open') return '制作中'
  if (s === 'forced_publish') return '公開済み'
  if (s === 'closed') return '終了'
  return s || '-'
}

export function statusBadge(status: RoomStatus) {
  const s = String(status ?? '').toLowerCase()
  if (s === 'open') return <span style={badgeStyle('rgba(16,185,129,0.14)', '#065f46')}>制作中</span>
  if (s === 'forced_publish')
    return <span style={badgeStyle('rgba(59,130,246,0.14)', '#1e40af')}>公開済み</span>
  if (s === 'closed') return <span style={badgeStyle('rgba(0,0,0,0.06)', '#111')}>終了</span>
  return <span style={badgeStyle('rgba(0,0,0,0.06)', '#111')}>{statusLabel(status)}</span>
}

export function categoryBadge(categoryOrType: string | null | undefined) {
  const cat = String(categoryOrType ?? '').trim() || 'その他'
  return <span style={badgeStyle('rgba(0,0,0,0.06)', '#111')}>{cat}</span>
}

export function aiLabel3(v: unknown): 'AI禁止' | 'AI補助' | 'AI自由' {
  const level: AiLevel = normalizeAiLevel(v, 'assist')
  if (level === 'forbidden') return 'AI禁止'
  if (level === 'free') return 'AI自由'
  return 'AI補助'
}

export function aiBadge(v: unknown) {
  const label = aiLabel3(v)
  // 色は「緑系で統一」（必要なら好みに合わせて変えてOK）
  return <span style={badgeStyle('rgba(16,185,129,0.14)', '#065f46')}>{label}</span>
}

export function adultBadge(isAdult: boolean | null | undefined) {
  if (!isAdult) return null
  return <span style={badgeStyle('rgba(239,68,68,0.14)', '#7f1d1d')}>成人向け</span>
}