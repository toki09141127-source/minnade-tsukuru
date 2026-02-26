'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SeenMarker({ roomId }: { roomId: string }) {
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) return
      if (cancelled) return

      // ✅ last_seen_at を安全に更新（RLS UPDATE不要）
      await supabase.rpc('mark_room_seen', { p_room_id: roomId })
    }

    run()

    return () => {
      cancelled = true
    }
  }, [supabase, roomId])

  return null
}