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

      if (!token) {
        console.log('[MarkReadOnView] no session (logged out), skip')
        return
      }
      if (canceled) return

      const res = await fetch('/api/rooms/mark-read', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      }).catch((e) => {
        console.log('[MarkReadOnView] fetch error', e)
        return null
      })

      if (!res) return

      const json = await res.json().catch(() => ({}))
      console.log('[MarkReadOnView]', res.status, json)
    }

    run()
    return () => {
      canceled = true
    }
  }, [roomId])

  return null
}