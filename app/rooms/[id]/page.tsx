// app/rooms/[id]/page.tsx
import Link from 'next/link'
import { supabaseAdmin } from '../../../lib/supabase/admin'

import JoinButton from './JoinButton'
import LikeButton from './LikeButton'
import BoardClient from './BoardClient'
import RemainingTimer from './RemainingTimer'
import AdultGate from './AdultGate'
import ReportButton from './ReportButton'
import DeleteRoomButton from './DeleteRoomButton'

export const dynamic = 'force-dynamic'

function isUuidLike(v: string) {
  // UUID v1-v5 を広く許容（大文字小文字OK）
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id?: string }>
}) {
  const p = await params
  const raw = typeof p?.id === 'string' ? p.id : ''
  const roomId = decodeURIComponent(raw).trim()


  // ✅ ここで弾く（ただし誤判定しないUUIDチェック）
  if (!roomId || !isUuidLike(roomId)) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 800 }}>roomId が不正です</p>

        {/* デバッグ（原因が掴めたら消してOK） */}
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: '#f6f7fb',
            borderRadius: 10,
            overflowX: 'auto',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
{JSON.stringify({ params, raw, roomId }, null, 2)}
        </pre>

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

  if (roomErr || !room || (room as any).deleted_at) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 800 }}>
          ルームが見つかりません（削除された可能性があります）
        </p>

        {/* デバッグ（原因が掴めたら消してOK） */}
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: '#f6f7fb',
            borderRadius: 10,
            overflowX: 'auto',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
{JSON.stringify({ roomId, roomErr: roomErr?.message ?? null, room }, null, 2)}
        </pre>

        <p style={{ marginTop: 12 }}>
          <Link href="/rooms">ルーム一覧へ戻る</Link>
        </p>
      </div>
    )
  }

  const isForced = room.status === 'forced_publish'

  // --- members（表示だけ。無ければ空でOK） ---
  const { data: members } = await supabaseAdmin
    .from('room_members')
    .select('id, username, is_core')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })

  return (
    <div style={{ padding: 24, maxWidth: 920, margin: '0 auto' }}>
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
                border: '1px solid rgba(255,80,80,0.25)',
                fontSize: 12,
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

      {/* 自動公開済み案内 */}
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
      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <JoinButton roomId={room.id} roomStatus={room.status} />
        <LikeButton roomId={room.id} />
      </div>

      {/* 成人向けゲート（成人向けルームのみ表示） */}
      {room.is_adult ? (
        <div style={{ marginTop: 12 }}>
          <AdultGate isAdult={true} />
        </div>
      ) : null}

      {/* 通報 + 削除（表示だけ。APIが403ならhost onlyでOK） */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ReportButton targetType="room" targetId={room.id} />
        <DeleteRoomButton roomId={room.id} />
      </div>

      {/* 参加者 */}
      <section style={{ marginTop: 20 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>参加者</h3>
        {!members || members.length === 0 ? (
          <p style={{ color: '#666' }}>まだ参加者がいません。</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {members.map((m: any) => (
              <li key={m.id} style={{ marginBottom: 6 }}>
                <strong>{m.username ?? '名無し'}</strong>
                {m.is_core ? (
                  <span style={{ marginLeft: 6, fontSize: 12, color: '#0b6' }}>[CORE]</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 掲示板 */}
      {!isForced ? (
        <div style={{ marginTop: 24 }}>
          <BoardClient roomId={room.id} roomStatus={room.status} />
        </div>
      ) : null}
    </div>
  )
}
