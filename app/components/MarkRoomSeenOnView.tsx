'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MarkRoomSeenOnView({ roomId }: { roomId: string }) {
  useEffect(() => {
    const controller = new AbortController()
    async function markSeen() {
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token
      if (!roomId || !token || controller.signal.aborted) return
      await fetch('/api/rooms/seen', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId }), signal: controller.signal,
      })
    }
    // Best effort: a failed seen update must not block reading the room.
    void markSeen().catch(() => {})
    return () => controller.abort()
  }, [roomId])
  return null
}
