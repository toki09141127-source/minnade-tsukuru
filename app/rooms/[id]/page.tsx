// app/rooms/[id]/page.tsx
import Link from 'next/link'
import { supabaseAdmin } from '../../../lib/supabase/admin'

import JoinButton from './JoinButton'
import LikeButton from './LikeButton'
import BoardClient from './BoardClient'
import RemainingTimer from './RemainingTimer'
import BackToRooms from './BackToRooms'
import AdultGate from './AdultGate'
import ReportButton from './ReportButton'
import DeleteRoomButton from './DeleteRoomButton'

export const dynamic = 'force-dynamic'

export default async function RoomDetailPage({ params }: { params: { id?: string } }) {
  const roomIdRaw = params?.id
  const roomId = typeof roomIdRaw === 'string' ? roomIdRaw : ''

  // ✅ 重要：/rooms/undefined などの壊れたURLをDBに投げない
  if (!roomId || roomId === 'undefined') {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>URLが不正です（roomId が空です）</p>
        <p style={{ marginTop: 8, opacity: 0.85 }}>roomId: {String(roomIdRaw)}</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/rooms">ルーム一覧へ戻る</Link>
        </p>
      </div>
    )
  }

  // ✅ rooms 取得（deleted_at も含めて判定）
  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select(
      'id, host_id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at'
    )
    .eq('id', roomId)
    .maybeSingle()

  if (roomErr || !room || room.deleted_at) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>
          ルームが見つかりません（削除された可能性があります）
        </p>
        <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13, lineHeight: 1.7 }}>
          <div>roomId: {roomId}</div>
          <div>roomErr: {roomErr?.message ?? ''}</div>
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
      {/* パンくず */}
      <p style={{ margin: '0 0 8px 0' }}>
        <Link href="/">← トップへ</Link> / <Link href="/rooms">ルーム一覧</Link>
      </p>

      {/* タイトル */}
      <h1 style={{ margin: '8px 0 6px 0' }}>{room.title}</h1>

      {/* サブ情報 */}
      <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.7 }}>
        <div>
          {room.work_type} / status: <b>{room.status}</b> / ❤️ {room.like_count ?? 0}
          {room.is_adult ? (
            <span
              style={{
                marginLeft: 10,
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 12,
                border: '1px solid rgba(255,0,0,0.35)',
                background: 'rgba(255,0,0,0.08)',
              }}
            >
              🔞 成人向け
            </span>
          ) : null}
        </div>
      </div>

      {/* 残り時間 */}
      <div style={{ marginTop: 10 }}>
        <RemainingTimer expiresAt={room.expires_at} status={room.status} />
      </div>

      {/* 公開済み案内 */}
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
          <p style={{ margin: '6px 0 0 0' }}>
            参加・投稿はできません。作品ページで完成物を読めます。
          </p>
          <p style={{ margin: '6px 0 0 0' }}>
            <Link href={`/works/${room.id}`}>→ 作品ページへ</Link>
          </p>
        </div>
      )}

      {/* 操作ボタン */}
      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <JoinButton roomId={room.id} roomStatus={room.status} />
        <LikeButton roomId={room.id} />
        <BackToRooms />
      </div>

      {/* ✅ ここから追加：成人向けゲート / 通報 / 削除 */}
      <div style={{ marginTop: 12 }}>
        <AdultGate isAdult={!!room.is_adult} />
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ReportButton targetType="room" targetId={room.id} />
      </div>

      <div style={{ marginTop: 12 }}>
        {/* 最短：表示だけ。APIが403ならhost only表示になる */}
        <DeleteRoomButton roomId={room.id} />
      </div>

      {/* 掲示板 */}
      <div style={{ marginTop: 24 }}>
        <BoardClient roomId={room.id} roomStatus={room.status} />
      </div>
    </div>
  )
}
