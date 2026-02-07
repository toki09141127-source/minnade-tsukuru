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

export default async function RoomDetailPage({ params }: { params: { id: string } }) {
  const roomId = params.id

  // ---- room ----
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
        <p style={{ marginTop: 8 }}>
          <Link href="/rooms">← ルーム一覧に戻る</Link>
        </p>
      </div>
    )
  }

  const isForced = room.status === 'forced_publish'

  // ---- members ----
  const { data: members } = await supabaseAdmin
    .from('room_members')
    .select('id, user_id, username, is_core, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })

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
            <span style={{ marginLeft: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,99,132,0.4)' }}>
              🔞 成人向け
            </span>
          ) : null}
        </div>
      </div>

      {/* 残り時間 */}
      <div style={{ marginTop: 10 }}>
        <RemainingTimer expiresAt={room.expires_at} status={room.status} />
      </div>

      {/* 公開済みなら案内 */}
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
          <p style={{ margin: 0, fontWeight: 900 }}>このルームは公開済みです</p>
          <p style={{ margin: '6px 0 0 0' }}>
            参加・投稿はできません。作品ページで完成物を読めます。
          </p>
          <p style={{ margin: '6px 0 0 0' }}>
            <Link href={`/works/${room.id}`}>→ 作品ページへ</Link>
          </p>
        </div>
      )}

      {/* ボタン列 */}
      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <JoinButton roomId={room.id} />
        <LikeButton roomId={room.id} />
        <BackToRooms />
      </div>

      {/* ✅ ここから追加：成人向けゲート / 通報 / 削除 */}
      <AdultGate isAdult={!!room.is_adult} />

      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ReportButton targetType="room" targetId={room.id} />
      </div>

      {/* “表示だけ”でOK（host only は API が 403 を返す） */}
      <div style={{ marginTop: 12 }}>
        <DeleteRoomButton roomId={room.id} />
      </div>

      {/* 参加者 */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: '0 0 6px 0' }}>参加者</h2>
        <p style={{ margin: '0 0 8px 0', opacity: 0.8 }}>（最大50人 / コア5人）</p>

        {!members || members.length === 0 ? (
          <p style={{ color: '#666' }}>まだ参加者がいません。</p>
        ) : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {members.map((m) => (
              <li key={m.id} style={{ marginBottom: 6 }}>
                <strong>{m.username ?? '名無し'}</strong>
                {m.is_core ? (
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#0b6' }}>[CORE]</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 掲示板 */}
      <div style={{ marginTop: 22 }}>
        <BoardClient roomId={room.id} roomStatus={room.status} />
      </div>
    </div>
  )
}
