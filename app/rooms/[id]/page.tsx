// app/rooms/[id]/page.tsx
import Link from 'next/link'
import { supabaseAdmin } from '../../../lib/supabase/admin' // ←あなたの環境に合わせて（既存のままでOK）

import JoinButton from './JoinButton'
import LikeButton from './LikeButton'
import BoardClient from './BoardClient'
import RemainingTimer from './RemainingTimer'
import BackToRooms from '../BackToRooms'

import AdultGate from './AdultGate'
import ReportButton from './ReportButton'
import DeleteRoomButton from './DeleteRoomButton'

export const dynamic = 'force-dynamic'

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  )
}

export default async function RoomDetailPage({
  params,
}: {
  params: { id?: string }
}) {
  const roomId = params?.id ?? ''

  // ✅ roomId ガード（ここは壊れやすいので強め）
  if (!roomId || !isUuid(roomId)) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>roomId が不正です</p>
        <p style={{ opacity: 0.8 }}>roomId: {String(roomId)}</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/rooms">ルーム一覧へ戻る</Link>
        </p>
      </div>
    )
  }

  // --- room ---
  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select(
      'id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at'
    )
    .eq('id', roomId)
    .maybeSingle()

  if (roomErr || !room || room.deleted_at) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>
          ルームが見つかりません（削除された可能性があります）
        </p>
        <p style={{ marginTop: 8, opacity: 0.85 }}>
          roomId: {roomId}
          <br />
          roomErr: {roomErr?.message ?? '(null)'}
          <br />
          deleted_at: {room?.deleted_at ?? '(null)'}
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/rooms">ルーム一覧へ戻る</Link>
        </p>
      </div>
    )
  }

  const isForced = room.status === 'forced_publish'

  return (
    <div style={{ padding: 24 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/">トップへ</Link> / <Link href="/rooms">ルーム一覧</Link>
      </p>

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
                background: 'rgba(255,80,80,0.12)',
                color: '#b00020',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              🔞 成人向け
            </span>
          ) : null}
        </div>
      </div>

      {/* ✅ 成人向けゲート（TSエラー対策：isAdult を必ず渡す） */}
      {room.is_adult ? (
        <div style={{ marginTop: 12 }}>
          <AdultGate isAdult={!!room.is_adult} />
        </div>
      ) : null}

      {/* ✅ 残り時間（TSエラー対策：status を必ず渡す） */}
      <div style={{ marginTop: 12 }}>
        <RemainingTimer expiresAt={room.expires_at} status={room.status} />
      </div>

      {/* 公開済み案内 */}
      {isForced && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 10,
            border: '1px solid rgba(255,193,7,0.45)',
            background: 'rgba(255,193,7,0.18)',
            lineHeight: 1.7,
          }}
        >
          <p style={{ margin: 0, fontWeight: 800 }}>このルームは公開済みです</p>
          <p style={{ margin: '6px 0 0 0' }}>
            参加・投稿はできません。作品ページで完成物を閲覧できます。
          </p>
          <p style={{ margin: '6px 0 0 0' }}>
            <Link href={`/works/${room.id}`}>→ 作品ページへ</Link>
          </p>
        </div>
      )}

      {/* 操作ボタン */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <JoinButton roomId={room.id} roomStatus={room.status} />
        <LikeButton roomId={room.id} />

        {/* 通報（表示だけ / API側で非表示処理） */}
        <ReportButton targetType="room" targetId={room.id} />
      </div>

      {/* ✅ 削除ボタン（表示だけ / 403なら host only 表示でOK） */}
      <div style={{ marginTop: 12 }}>
        <DeleteRoomButton roomId={room.id} />
      </div>

      {/* 掲示板 */}
      <div style={{ marginTop: 20 }}>
        <BoardClient roomId={room.id} roomStatus={room.status} />
      </div>

      <div style={{ marginTop: 16 }}>
        <BackToRooms />
      </div>
    </div>
  )
}
