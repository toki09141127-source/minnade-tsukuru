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
  // ended_at が「あるなら」取得（無ければ無理に追加しない）
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
    throw withoutEndedAt.error
  }

  return (withoutEndedAt.data ?? null) as RoomRow | null
}

function computeIsEnded(room: RoomRow) {
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
        <p style={{ color: 'crimson', fontWeight: 700 }}>ルームが見つかりません</p>
        <Link href="/rooms">ルーム一覧へ戻る</Link>
      </div>
    )
  }

  const isEnded = computeIsEnded(room)
  const isForced = room.status === 'forced_publish'
  const isOpen = room.status === 'open'

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* 戻る */}
      <Link href="/rooms">← ルーム一覧へ戻る</Link>

      {/* タイトル */}
      <h1 style={{ marginTop: 10 }}>{room.title}</h1>

      {/* メタ（work_type/status/like_count/成人向け） */}
      <div style={{ marginTop: 8, fontSize: 13, color: '#555', lineHeight: 1.8 }}>
        <div>
          <b>種別:</b> {room.work_type ?? '-'}
          {'  '}|{'  '}
          <b>ステータス:</b> {room.status}
          {'  '}|{'  '}
          <b>いいね:</b> {room.like_count ?? 0}
          {'  '}|{'  '}
          <b>成人向け:</b> {room.is_adult ? 'はい' : 'いいえ'}
        </div>
      </div>

      {/* AdultGate（必ず復活） */}
      <div style={{ marginTop: 12 }}>
        <AdultGate isAdult={!!room.is_adult} />
      </div>

      {/* コンセプト */}
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

      {/* タイマー */}
      <div style={{ marginTop: 12 }}>
        <RemainingTimer expiresAt={room.expires_at} status={room.status} />
      </div>

      {/* 操作ボタン群（必ず復活） */}
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <JoinButton roomId={room.id} roomStatus={room.status} />
        <LikeButton roomId={room.id} />
        <ReportButton targetType="room" targetId={room.id} />
        <DeleteRoomButton roomId={room.id} />
      </div>

      {/* forced_publish：公開済み案内＋作品リンク（投稿UIは出さない） */}
      {isForced && (
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
            このルームは公開済みです
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

      {/* forced_publish 以外の「終了済み」：終了案内＋作品リンク（必ず表示） */}
      {!isForced && isEnded && (
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

      {/* open のときだけ BoardClient（投稿UI）を表示 */}
      {isOpen && (
        <div style={{ marginTop: 28 }}>
          <BoardClient roomId={room.id} roomStatus={room.status} />
        </div>
      )}
    </div>
  )
}
