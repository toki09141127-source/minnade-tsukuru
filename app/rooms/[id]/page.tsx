// app/rooms/[id]/page.tsx
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { supabase } from '../../../lib/supabase/client'
import JoinButton from './JoinButton'
import RemainingTimer from './RemainingTimer'
import BoardClient from './BoardClient'
import LikeButton from './LikeButton'
import DeleteRoomButton from './DeleteRoomButton'

type RoomRow = {
  id: string
  title: string
  work_type: string
  status: string
  time_limit_hours: number
  created_at: string
  expires_at: string | null
  like_count: number | null
  user_id: string
}

type MemberRow = {
  id: string
  user_id: string
  username: string | null
  is_core: boolean
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const p = await Promise.resolve(params)
  const roomId = p?.id

  if (!roomId) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#b00020' }}>URLの id が取得できませんでした。</p>
        <Link href="/">← 一覧に戻る</Link>
      </div>
    )
  }

  // ルーム取得
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select(
      'id, title, work_type, status, time_limit_hours, created_at, expires_at, like_count, user_id'
    )
    .eq('id', roomId)
    .single<RoomRow>()

  if (roomErr || !room) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#b00020' }}>
          取得エラー: {roomErr?.message ?? 'room not found'}
        </p>
        <Link href="/">← 一覧に戻る</Link>
      </div>
    )
  }

  // 参加者取得
  const { data: members } = await supabase
    .from('room_members')
    .select('id, user_id, username, is_core')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })
    .returns<MemberRow[]>()

  const memberCount = members?.length ?? 0

  // 現在ユーザー（削除ボタン表示用）
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isOwner = user?.id === room.user_id

  return (
    <div style={{ padding: 24 }}>
      {/* ← 一覧に戻る（トップ） */}
      <Link href="/">← 制作ルーム一覧に戻る</Link>

      <h1 style={{ marginTop: 8 }}>{room.title}</h1>

      <div style={{ marginTop: 10, fontSize: 14, color: '#444' }}>
        {room.work_type} / status: {room.status} / ❤️ {room.like_count ?? 0} / 👥{' '}
        {memberCount}
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 14,
          background: '#eef3ff',
          borderRadius: 10,
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        <strong>はじめての人へ</strong>
        <br />
        コア5人＋最大50人で作る時間制限付き合作ルームです。
        <br />
        期限を過ぎると自動で forced_publish になります。
      </div>

      {/* 残り時間 */}
      <div style={{ marginTop: 12 }}>
        <RemainingTimer expiresAt={room.expires_at} />
      </div>

      {/* 操作ボタン */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <JoinButton roomId={room.id} roomStatus={room.status} />
        <LikeButton roomId={room.id} />

        {/* 作成者のみ削除可能 */}
        {isOwner && <DeleteRoomButton roomId={room.id} />}
      </div>

      {/* 参加者一覧 */}
      <section style={{ marginTop: 18 }}>
        <h2>参加者（最大50人 / コア5人）</h2>

        {!members || members.length === 0 ? (
          <p style={{ color: '#666' }}>まだ参加者がいません。</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {members.map((m) => (
              <li key={m.id}>
                <strong>{m.username ?? '名無し'}</strong>
                {m.is_core && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 12,
                      color: '#0b6',
                    }}
                  >
                    （CORE）
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 掲示板 */}
      <BoardClient roomId={room.id} roomStatus={room.status} />
    </div>
  )
}
