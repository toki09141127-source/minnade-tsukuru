'use client'

import { supabase } from '../../../lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DeleteRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter()

  const deleteRoom = async () => {
    if (!confirm('本当に削除しますか？')) return

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/rooms/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ roomId }),
    })

    const json = await res.json()
    if (!json.ok) {
      alert(json.error)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={deleteRoom}
      style={{
        marginLeft: 8,
        padding: '6px 12px',
        background: '#c00',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      ルーム削除
    </button>
  )
}
