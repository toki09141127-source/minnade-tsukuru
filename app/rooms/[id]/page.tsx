import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'

import RemainingTimer from './RemainingTimer'
import DeleteRoomButton from './DeleteRoomButton'
import AdultGate from './AdultGate'
import ReportButton from './ReportButton'
import LikeButton from './LikeButton'
import RoomDetailClient from './RoomDetailClient'

export const dynamic = 'force-dynamic'

type Params = { id?: string }

type RoomRow = {
  id: string
  title: string | null
  work_type: string | null
  status: string
  created_at: string | null
  expires_at: string | null
  time_limit_hours: number | null
  like_count: number | null
  is_adult: boolean | null
  deleted_at: string | null
  is_hidden: boolean | null
  concept: string | null
  ended_at?: string | null

  enable_core_approval: boolean
  enable_core_invite: boolean
  core_invite_code: string | null
}

async function fetchRoomWithOptionalEndedAt(roomId: string): Promise<RoomRow | null> {
  const withEndedAt = await supabaseAdmin
    .from('rooms')
    .select(
      'id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at, is_hidden, concept, ended_at, enable_core_approval, enable_core_invite, core_invite_code'
    )
    .eq('id', roomId)
    .maybeSingle()

  if (!withEndedAt.error) return (withEndedAt.data ?? null) as any

  const withoutEndedAt = await supabaseAdmin
    .from('rooms')
    .select(
      'id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at, is_hidden, concept, enable_core_approval, enable_core_invite, core_invite_code'
    )
    .eq('id', roomId)
    .maybeSingle()

  if (withoutEndedAt.error) throw withoutEndedAt.error
  return (withoutEndedAt.data ?? null) as any
}

function computeIsEnded(room: RoomRow) {
  const nowMs = Date.now()
  const endedByStatus = room.status === 'forced_publish' || room.status === 'closed'

  const expiresMs =
    room.expires_at && !Number.isNaN(new Date(room.expires_at).getTime())
      ? new Date(room.expires_at).getTime()
      : null

  const endedByExpireSafety = expiresMs !== null && expiresMs <= nowMs && room.status !== 'open'
  const endedByEndedAt = room.ended_at != null && room.ended_at !== ''
  return endedByStatus || endedByExpireSafety || endedByEndedAt
}

export default async function RoomDetailPage({
  params,
}: {
  params: Params | Promise<Params>
}) {
  const p = await Promise.resolve(params)
  const roomId = p?.id ?? ''

  if (!roomId || roomId.length < 10) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>roomId が不正です</p>
        <Link href="/rooms">ルーム一覧へ戻る</Link>
      </div>
    )
  }

  const room = await fetchRoomWithOptionalEndedAt(roomId)

  if (!room || room.deleted_at || room.is_hidden) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>ルームが見つかりません</p>
        <Link href="/rooms">ルーム一覧へ戻る</Link>
      </div>
    )
  }

  const isEnded = computeIsEnded(room)
  const isForced = room.status === 'forced_publish'
  const isOpen = room.status === 'open'

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Link href="/rooms">← ルーム一覧へ戻る</Link>

      <h1 style={{ marginTop: 10 }}>{room.title}</h1>

      <div style={{ marginTop: 8, fontSize: 13, color: '#555', lineHeight: 1.8 }}>
        <div>
          <b>種別:</b> {room.work_type ?? '-'}
          {'  '}|{'  '}
          <b>ステータス:</b> {room.status}
          {'  '}|{'  '}
          <b>いいね:</b> {room.like_count ?? 0}
          {'  '}|{'  '}
          <b>成人向け:</b> {room.is_adult ? 'はい' : 'いいえ'}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <AdultGate isAdult={!!room.is_adult} />
      </div>

      {room.concept && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 12,
            background: '#f8f8f8',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>コンセプト</div>
          {room.concept}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <RemainingTimer expiresAt={room.expires_at} status={room.status} />
      </div>

      {/* Like/Report/Delete は「常時表示」したい場合ここに残す（Join等は clientへ集約） */}
      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <LikeButton roomId={room.id} />
        <ReportButton targetType="room" targetId={room.id} />
        <DeleteRoomButton roomId={room.id} />
      </div>

      {isForced && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: '1px solid #f3d08a', background: '#fff7e6', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>このルームは公開済みです</div>
          <div style={{ marginTop: 6, color: '#6b4a00', fontWeight: 700 }}>参加・投稿はできません</div>
          <div style={{ marginTop: 12 }}>
            <Link
              href={`/works/${room.id}`}
              style={{
                display: 'inline-block',
                padding: '10px 14px',
                borderRadius: 12,
                background: '#e48a00',
                color: 'white',
                fontWeight: 900,
                textDecoration: 'none',
              }}
            >
              作品ページへ →
            </Link>
          </div>
        </div>
      )}

      {!isForced && isEnded && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 14, border: '1px solid #f3d08a', background: '#fff7e6', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>このルームはすでに終了しました</div>
          <div style={{ marginTop: 6, color: '#6b4a00', fontWeight: 700 }}>参加・投稿はできません</div>
          <div style={{ marginTop: 12 }}>
            <Link
              href={`/works/${room.id}`}
              style={{
                display: 'inline-block',
                padding: '10px 14px',
                borderRadius: 12,
                background: '#e48a00',
                color: 'white',
                fontWeight: 900,
                textDecoration: 'none',
              }}
            >
              作品ページへ →
            </Link>
          </div>
        </div>
      )}

      {/* open のときだけ client側メニュー＋掲示板（参加ロール統合） */}
      {isOpen && !isForced && !isEnded && (
        <RoomDetailClient
          room={{
            id: room.id,
            status: room.status,
            enable_core_approval: !!room.enable_core_approval,
            enable_core_invite: !!room.enable_core_invite,
          }}
        />
      )}
    </div>
  )
}
