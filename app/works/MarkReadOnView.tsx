// app/works/MarkReadOnView.tsx
'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '../../lib/supabase/client'

// ✅ RoomsListClient と同じキーを使う（変更しない）
const UNREAD_CACHE_KEY = 'unread_map_v1'

export default function MarkReadOnView({ roomId }: { roomId: string }) {
  const ranRef = useRef(false)

  useEffect(() => {
    if (!roomId) return
    if (ranRef.current) return
    ranRef.current = true

    let canceled = false

    const run = async () => {
      try {
        const supabase = createClient()

        // 1) セッション（token）取得。無ければ何もしない
        const { data } = await supabase.auth.getSession()
        const token = data?.session?.access_token
        if (!token) {
          console.log('[MarkReadOnView] no session (logged out), skip')
          return
        }
        if (canceled) return

        // 2) ✅ 既読更新：/api/rooms/seen（last_seen_at を更新）
        const res = await fetch('/api/rooms/seen', {
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

        if (!res.ok || json?.ok === false) return

        // 3) ✅ 成功時：sessionStorage の unread_map_v1 から該当 roomId を削除
        try {
          const raw = sessionStorage.getItem(UNREAD_CACHE_KEY)
          if (!raw) return

          const parsed = JSON.parse(raw) as any
          const map = parsed?.map
          const ts = parsed?.ts

          // 期待構造 { ts, map } 以外なら安全に無視
          if (!map || typeof map !== 'object') return

          if (roomId in map) {
            delete map[roomId]
            sessionStorage.setItem(UNREAD_CACHE_KEY, JSON.stringify({ ts: Date.now(), map }))
          }
        } catch (e) {
          console.log('[MarkReadOnView] cache update failed', e)
        }
      } catch (e) {
        console.log('[MarkReadOnView] unexpected error', e)
      }
    }

    void run()

    return () => {
      canceled = true
    }
  }, [roomId])

  return null
}