// app/rooms/[id]/page.tsx
import Link from 'next/link'
import { supabaseAdmin } from '../../../lib/supabase/admin'

import JoinButton from './JoinButton'
import LikeButton from './LikeButton'
import BoardClient from './BoardClient'
import RemainingTimer from '../RemainingTimer'

// ✅ ここ重要：BackToRooms は app/rooms/BackToRooms.tsx にあるので「../」
import BackToRooms from '../BackToRooms'

import DeleteRoomButton from './DeleteRoomButton'
import AdultGate from './AdultGate'
import ReportButton from './ReportButton'

export const dynamic = 'force-dynamic'

export default async function RoomDetailPage({ params }: { params: { id: string } }) {
  const roomId = params.id

  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('id, host_id, title, work_type, status, created_at, expires_at, time_limit_hours, like_count, is_adult, deleted_at')
    .eq('id', roomId)
    .maybeSingle()

    if (roomErr || !room || (room as any).deleted_at) {
      return (
        <div style={{ padding: 24 }}>
          <p style={{ color: 'crimson', fontWeight: 700 }}>
            ルームが見つかりません（削除された可能性があります）
          </p>
    
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
            <div>roomId: {roomId}</div>
            <div>roomErr: {roomErr?.message ?? '(none)'}</div>
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
      <p style={{ marginTop: 0 }}>
        <Link href="/">← トップへ</Link> / <Link href="/rooms">ルーム一覧</Link>
      </p>

      {/* タイトル */}
      <h1 style={{ margin: '8px 0 6px 0' }}>{room.title}</h1>

      {/* サブ情報 */}
      <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.7 }}>
        <div>
          {room.work_type} / status: <b>{room.status}</b> / ❤️ {room.like_count ?? 0}
          {room.is_adult ? (
            <span style={{ marginLeft: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255, 193, 7, 0.45)', background: 'rgba(255, 193, 7, 0.18)' }}>
              🔞 成人向け
            </span>
          ) : null}
        </div>
      </div>

      {/* 残り時間 */}
      <div style={{ marginTop: 10 }}>
        {/* ✅ RemainingTimer は expiresAt だけ渡す（status は渡さない） */}
        <RemainingTimer expiresAt={room.expires_at} />
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
          <p style={{ margin: 0, fontWeight: 700 }}>このルームは公開済みです</p>
          <p style={{ margin: '6px 0 0 0' }}>
            参加・投稿はできません。作品ページで完成物を読めます。<br />
            → <Link href={`/works/${room.id}`}>作品ページへ</Link>
          </p>
        </div>
      )}

      {/* 操作ボタン */}
      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {/* ✅ JoinButton は roomStatus 必須 */}
        <JoinButton roomId={room.id} roomStatus={room.status} />
        <LikeButton roomId={room.id} />
        <BackToRooms />
      </div>

      {/* ✅ 成人向けゲート（成人向けルームだけ表示） */}
      {room.is_adult ? <AdultGate isAdult={true} /> : null}

      {/* ✅ 通報 */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ReportButton targetType="room" targetId={room.id} />
      </div>

      {/* ✅ 削除 */}
      <div style={{ marginTop: 12 }}>
        <DeleteRoomButton roomId={room.id} />
      </div>

      {/* 掲示板 */}
      <div style={{ marginTop: 24 }}>
        {/* BoardClient 側の props に合わせて渡す */}
        <BoardClient roomId={room.id} roomStatus={room.status} />
      </div>
    </div>
  )
}
