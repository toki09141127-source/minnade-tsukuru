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
  // ✅ params Promise 対応（Next.js対策）
  const p = await Promise.resolve(params)
  const roomId = p?.id ?? ''

  // ✅ roomId が空/不正のとき
  if (!roomId || roomId.length < 10) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>roomId が不正です</p>
        <p style={{ opacity: 0.8 }}>roomId: {String(roomId)}</p>
        <Link href="/rooms">ルーム一覧へ戻る</Link>
      </div>
    )
  }

  // ✅ ルーム取得
  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select(
      'id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at, is_hidden'
    )
    .eq('id', roomId)
    .maybeSingle()

  // ✅ 見つからない / 論理削除 / 非表示 は弾く
  if (roomErr || !room || room.deleted_at || room.is_hidden) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 700 }}>
          ルームが見つかりません（削除された可能性があります）
        </p>
        <p style={{ opacity: 0.8 }}>
          roomId: {roomId}
          <br />
          roomErr: {roomErr?.message ?? '(null)'}
        </p>
        <Link href="/rooms">ルーム一覧へ戻る</Link>
      </div>
    )
  }

  const isForced = room.status === 'forced_publish'

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* 戻る */}
      <p style={{ marginBottom: 12 }}>
        <Link href="/rooms">← ルーム一覧へ戻る</Link>
      </p>

      {/* タイトル */}
      <h1 style={{ margin: '8px 0 6px 0' }}>{room.title}</h1>

      {/* メタ */}
      <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.7 }}>
        {room.work_type} / status: <b>{room.status}</b> / ❤️{' '}
        {room.like_count ?? 0}
        {room.is_adult ? (
          <span style={{ marginLeft: 10, color: '#c2185b', fontWeight: 700 }}>
            成人向け
          </span>
        ) : null}
      </div>

      {/* 成人ゲート */}
      {room.is_adult && (
        <div style={{ marginTop: 12 }}>
          <AdultGate isAdult={true} />
        </div>
      )}

      {/* 残り時間 */}
      <div style={{ marginTop: 12 }}>
        <RemainingTimer expiresAt={room.expires_at} status={room.status} />
      </div>

      {/* 公開済み案内 */}
      {isForced && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 10,
            border: '1px solid rgba(255, 193, 7, 0.5)',
            background: 'rgba(255, 193, 7, 0.15)',
            lineHeight: 1.7,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>このルームは公開済みです</p>
          <p style={{ margin: '6px 0 0 0' }}>
            参加・投稿はできません。作品ページで完成物を読めます。
          </p>
          <p style={{ margin: '6px 0 0 0' }}>
            <Link href={`/works/${room.id}`}>作品ページへ</Link>
          </p>
        </div>
      )}

      {/* 操作ボタン */}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <JoinButton roomId={room.id} roomStatus={room.status} />
        <LikeButton roomId={room.id} />
        <ReportButton targetType="room" targetId={room.id} />
        <DeleteRoomButton roomId={room.id} />
      </div>

      {/* 掲示板（旧フォーム削除済み） */}
      {!isForced && (
        <div style={{ marginTop: 28 }}>
          <BoardClient roomId={room.id} roomStatus={room.status} />
        </div>
      )}
    </div>
  )
}
