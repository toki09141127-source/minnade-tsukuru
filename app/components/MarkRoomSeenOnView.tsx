'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MarkRoomSeenOnView({ roomId }: { roomId: string }) {
  const ranRef = useRef(false)

  useEffect(() => {
    if (!roomId) return
    if (ranRef.current) return
    ranRef.current = true

    const run = async () => {
      const supabase = createClient()

      const { data: u } = await supabase.auth.getUser()
      const userId = u.user?.id
      if (!userId) return

      // ✅ unread_counts_for_me() が参照する room_members.last_seen_at を更新する
      await supabase
        .from('room_members')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .is('left_at', null)
    }

    run().catch(() => {
      // 失敗してもUIは壊さない（ネットワーク/RLSなど）
    })
  }, [roomId])

  return null
}