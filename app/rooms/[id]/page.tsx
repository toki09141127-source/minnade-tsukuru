// app/rooms/[id]/page.tsx
import Link from 'next/link'
import { supabaseAdmin } from '../../../lib/supabase/admin'

import JoinButton from './JoinButton'
import LikeButton from './LikeButton'
import BoardClient from './BoardClient'
import RemainingTimer from './RemainingTimer'
import BackToRooms from '../BackToRooms'
import DeleteRoomButton from './DeleteRoomButton'
import AdultGate from './AdultGate'
import ReportButton from './ReportButton'

export const dynamic = 'force-dynamic'

export default async function RoomDetailPage({
  params,
}: {
  params: { id?: string }
}) {
  const roomId = (params?.id ?? '').trim()

  // まず roomId の形だけ先にチェック（undefined / 空などを弾く）
  if (!roomId) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>roomId が不正です</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/rooms">ルーム一覧へ戻る</Link>
        </p>
      </div>
    )
  }

  // rooms 取得（※host_idはselectしない：列が無い環境があるため）
  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select(
      'id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at'
    )
    .eq('id', roomId)
    .maybeSingle()

  // 見つからない/削除済み
  if (roomErr || !room || room.deleted_at) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>
          ルームが見つかりません（削除された可能性があります）
        </p>

        {/* デバッグ表示（必要なら残してOK） */}
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: '#fff2f2',
            borderRadius: 10,
            lineHeight: 1.7,
            fontSize: 13,
          }}
        >
          <div>roomId: {roomId || '(empty)'}</div>
          <div>roomErr: {roomErr?.message ?? '(null)'}</div>
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
      <p style={{ margin: 0 }}>
        <Link href="/">トップへ</Link> / <Link href="/rooms">ルーム一覧</Link>
      </p>

      {/* タイトル */}
      <h1 style={{ margin: '10px 0 8px 0' }}>{room.title}</h1>

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
                background: 'rgba(255, 70, 70, 0.15)',
                border: '1px solid rgba(255, 70, 70, 0.35)',
              }}
            >
              🔞 成人向け
            </span>
          ) : null}
        </div>
      </div>

      {/* ✅ 成人向けゲート（props必須） */}
      <div style={{ marginTop: 12 }}>
        <AdultGate isAdult={!!room.is_adult} />
      </div>

      {/* ✅ 残り時間（status必須） */}
      <div style={{ marginTop: 12 }}>
        <RemainingTimer expiresAt={room.expires_at} status={room.status} />
      </div>

      {/* forced_publish 案内 */}
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
            参加・投稿はできません。作品ページで完成物を読みます。
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

      {/* 通報・削除（表示はOK。APIが403ならhost only表示でOK） */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ReportButton targetType="room" targetId={room.id} />
      </div>

      <div style={{ marginTop: 12 }}>
        <DeleteRoomButton roomId={room.id} />
      </div>

      {/* 掲示板 */}
      <div style={{ marginTop: 24 }}>
        <BoardClient roomId={room.id} roomStatus={room.status} />
      </div>
    </div>
  )
}
