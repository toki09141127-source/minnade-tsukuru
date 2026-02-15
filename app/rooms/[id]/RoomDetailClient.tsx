// app/rooms/[id]/RoomDetailClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

import JoinButton from './JoinButton'
import LikeButton from './LikeButton'
import DeleteRoomButton from './DeleteRoomButton'
import ReportButton from './ReportButton'
import BoardClient from './BoardClient'

type RoomLite = {
  id: string
  status: string
}

export default function RoomDetailClient({ room }: { room: RoomLite }) {
  const [joined, setJoined] = useState(false)
  const [checked, setChecked] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id ?? null
      setUserId(uid)

      if (!uid) {
        setChecked(true)
        setJoined(false)
        return
      }

      const { data, error } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('room_id', room.id)
        .eq('user_id', uid)
        .is('left_at', null)
        .maybeSingle()

      // 読めない/エラー時は安全側（未参加扱い）
      if (error) {
        setJoined(false)
        setChecked(true)
        return
      }

      setJoined(!!data)
      setChecked(true)
    }

    init()
  }, [room.id])

  const isOpen = room.status === 'open'

  return (
    <>
      {/* 操作ボタン群（client側に寄せて、join後の即時反映を確実にする） */}
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <JoinButton
          roomId={room.id}
          roomStatus={room.status}
          onJoined={() => setJoined(true)}
        />
        <LikeButton roomId={room.id} />
        <ReportButton targetType="room" targetId={room.id} />
        <DeleteRoomButton roomId={room.id} />
      </div>

      {/* open かつ ログイン済み かつ 参加済み なら BoardClient を表示（確実に） */}
      {isOpen && checked && userId && joined && (
        <div style={{ marginTop: 28 }}>
          <BoardClient roomId={room.id} roomStatus={room.status} />
        </div>
      )}

      {/* open だが未参加なら案内（閲覧はOK、投稿は不可の方針に一致） */}
      {isOpen && checked && userId && !joined && (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.10)',
            background: '#fafafa',
            lineHeight: 1.7,
            color: '#555',
          }}
        >
          参加すると掲示板に投稿できます。
        </div>
      )}

      {/* 未ログインなら案内 */}
      {isOpen && checked && !userId && (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.10)',
            background: '#fafafa',
            lineHeight: 1.7,
            color: '#555',
          }}
        >
          ログインすると参加・投稿できます。
        </div>
      )}
    </>
  )
}
