'use client'

import { useEffect } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function MarkReadOnView({ roomId }: { roomId: string }) {
  useEffect(() => {
    let canceled = false

    const run = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token

      // ログアウト中は既読化しない（壊さない）
      if (!token) return
      if (canceled) return

      await fetch('/api/rooms/mark-read', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      }).catch(() => {})
    }

    run()
    return () => {
      canceled = true
    }
  }, [roomId])

  return null
}