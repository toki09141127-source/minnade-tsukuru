// app/rooms/[id]/page.tsx
import Link from 'next/link'
import { supabaseAdmin } from '../../../lib/supabase/admin'

import JoinButton from './JoinButton'
import LikeButton from './LikeButton'
import BoardClient from './BoardClient'
import RemainingTimer from './RemainingTimer'
import BackToRooms from '../BackToRooms'

import AdultGate from './AdultGate'
import ReportButton from './ReportButton'
import DeleteRoomButton from './DeleteRoomButton'

export const dynamic = 'force-dynamic'

function isUuid(v: unknown) {
  if (typeof v !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export default async function RoomDetailPage({
  params,
}: {
  // ✅ Next 16系だと params が Promise のことがある
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const roomId = String(id ?? '').trim()

  if (!isUuid(roomId)) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 800 }}>roomId が不正です</p>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
          <div>raw id: {String(id)}</div>
          <div>roomId: {roomId || '(empty)'}</div>
        </div>
        <p style={{ marginTop: 12 }}>
          <Link href="/rooms">ルーム一覧へ戻る</Link>
        </p>
      </div>
    )
  }

  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('id, host_id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at')
    .eq('id', roomId)
    .maybeSingle()

  if (roomErr || !room || room.deleted_at) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 800 }}>ルームが見つかりません（削除された可能性があります）</p>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
          <div>roomId: {roomId}</div>
          <div>roomErr: {roomErr?.message ?? '(none)'}</div>
          <div>deleted_at: {room?.deleted_at ? String(room.deleted_at) : '(null)'}</div>
        </div>
        <p style={{ marginTop: 12 }}>
          <Link href="/rooms">ルーム一覧へ戻る</Link>
        </p>
      </div>
    )
  }

  const isForced = room.status === 'forced_publish'

  return (
    <div style={{ padding: 24 }}>
      <p style={{ margin: 0 }}>
        <Link href="/">← トップへ</Link> / <Link href="/rooms">ルーム一覧</Link>
      </p>

      <h1 style={{ margin: '8px 0 6px 0' }}>{room.title}</h1>

      <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.7 }}>
        <div>
          {room.work_type} / status: <b>{room.status}</b> / ❤️ {room.like_count ?? 0}
          {room.is_adult ? <span style={{ marginLeft: 10 }}>🔞 成人向け</span> : null}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <RemainingTimer expiresAt={room.expires_at} status={room.status} />
      </div>

      {isForced && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 10,
            border: '1px solid rgba(255, 193, 7, 0.45)',
            background: 'rgba(255, 193, 7, 0.18)',
            lineHeight: 1.7,
          }}
        >
          <p style={{ margin: 0, fontWeight: 800 }}>このルームは公開済みです</p>
          <p style={{ margin: '6px 0 0 0' }}>参加・投稿はできません。作品ページで完成物を読めます。</p>
          <p style={{ margin: '6px 0 0 0' }}>
            <Link href={`/works/${room.id}`}>→ 作品ページへ</Link>
          </p>
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <JoinButton roomId={room.id} roomStatus={room.status} />
        <LikeButton roomId={room.id} />
        <BackToRooms />
      </div>

      <AdultGate isAdult={!!room.is_adult} />

      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ReportButton targetType="room" targetId={room.id} />
      </div>

      <div style={{ marginTop: 12 }}>
        <DeleteRoomButton roomId={room.id} />
      </div>

      <div style={{ marginTop: 24 }}>
        <BoardClient roomId={room.id} roomStatus={room.status} />
      </div>
    </div>
  )
}
