import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'

import RemainingTimer from './RemainingTimer'
import BoardClient from './BoardClient'

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
}

async function fetchRoomWithOptionalEndedAt(roomId: string): Promise<RoomRow | null> {
  // 1) ended_at が「あるなら」取得（無ければ無理に追加しない）
  //    まず ended_at ありで試し、列が無い等で失敗したら ended_at なしで再試行。
  const withEndedAt = await supabaseAdmin
    .from('rooms')
    .select(
      'id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at, is_hidden, concept, ended_at'
    )
    .eq('id', roomId)
    .maybeSingle()

  if (!withEndedAt.error) {
    return (withEndedAt.data ?? null) as RoomRow | null
  }

  const withoutEndedAt = await supabaseAdmin
    .from('rooms')
    .select(
      'id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at, is_hidden, concept'
    )
    .eq('id', roomId)
    .maybeSingle()

  if (withoutEndedAt.error) {
    // ここで握りつぶすと原因が追えないので throw
    throw withoutEndedAt.error
  }

  return (withoutEndedAt.data ?? null) as RoomRow | null
}

function computeIsEnded(room: RoomRow) {
  // 2) const isEnded = (...) を作り、終了判定を一本化
  const nowMs = Date.now()

  // A) status が forced_publish または closed
  const endedByStatus = room.status === 'forced_publish' || room.status === 'closed'

  // B) expires_at が過去（<= now）で、かつ status !== 'open'
  const expiresMs =
    room.expires_at && !Number.isNaN(new Date(room.expires_at).getTime())
      ? new Date(room.expires_at).getTime()
      : null

  const endedByExpireSafety =
    expiresMs !== null && expiresMs <= nowMs && room.status !== 'open'

  // C) ended_at があるなら ended_at is not null
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
        <p style={{ color: 'crimson', fontWeight: 700 }}>
          ルームが見つかりません
        </p>
        <Link href="/rooms">ルーム一覧へ戻る</Link>
      </div>
    )
  }

  const isEnded = computeIsEnded(room)

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Link href="/rooms">← ルーム一覧へ戻る</Link>

      <h1 style={{ marginTop: 10 }}>{room.title}</h1>

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

      {/* 3) isEnded のときは必ず案内UI（目立つボックス）を表示 */}
      {isEnded && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 14,
            border: '1px solid #f3d08a',
            background: '#fff7e6',
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            このルームはすでに終了しました
          </div>
          <div style={{ marginTop: 6, color: '#6b4a00', fontWeight: 700 }}>
            参加・投稿はできません
          </div>

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

      {/* 4) 掲示板表示は open のときだけ（それ以外は絶対出さない） */}
      {room.status === 'open' && (
        <div style={{ marginTop: 28 }}>
          <BoardClient roomId={room.id} roomStatus={room.status} />
        </div>
      )}
    </div>
  )
}
