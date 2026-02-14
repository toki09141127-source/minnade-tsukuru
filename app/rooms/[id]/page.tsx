import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'

import JoinButton from './JoinButton'
import LikeButton from './LikeButton'
import RemainingTimer from './RemainingTimer'
import DeleteRoomButton from './DeleteRoomButton'
import AdultGate from './AdultGate'
import ReportButton from './ReportButton'
import BoardClient from './BoardClient'

export const dynamic = 'force-dynamic'

type Params = { id?: string }

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

  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select(
      'id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at, is_hidden, concept'
    )
    .eq('id', roomId)
    .maybeSingle()

  if (roomErr || !room || room.deleted_at || room.is_hidden) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>
          ルームが見つかりません
        </p>
        <Link href="/rooms">ルーム一覧へ戻る</Link>
      </div>
    )
  }

  const isForced = room.status === 'forced_publish'

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
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            コンセプト
          </div>
          {room.concept}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <RemainingTimer expiresAt={room.expires_at} status={room.status} />
      </div>

      {!isForced && (
        <div style={{ marginTop: 28 }}>
          <BoardClient roomId={room.id} roomStatus={room.status} />
        </div>
      )}
    </div>
  )
}
