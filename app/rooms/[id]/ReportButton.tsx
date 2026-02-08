// app/rooms/[id]/ReportButton.tsx
'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function ReportButton({
  targetType,
  targetId,
}: {
  targetType: 'room' | 'post'
  targetId: string
}) {
  const [msg, setMsg] = useState<string>('')

  const report = async () => {
    setMsg('')

    const { data: s } = await supabase.auth.getSession()
    const token = s.session?.access_token
    if (!token) {
      setMsg('ログインしてください')
      return
    }

    const reason = prompt('通報理由（任意）') ?? ''

    const res = await fetch('/api/reports/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        targetType,
        targetId,
        reason,
      }),
    })

    const json = await res.json()
    if (!json.ok) {
      setMsg(json.error ?? '通報に失敗しました')
      return
    }

    setMsg('通報しました（運営が確認します）')
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button
        onClick={report}
        style={{
          border: '1px solid #ccc',
          borderRadius: 999,
          padding: '4px 10px',
          fontSize: 12,
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        通報
      </button>
      {msg && <span style={{ fontSize: 12, opacity: 0.75 }}>{msg}</span>}
    </span>
  )
}
