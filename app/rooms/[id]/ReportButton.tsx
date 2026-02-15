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
  const [loading, setLoading] = useState(false)

  const report = async () => {
    setMsg('')
    setLoading(true)

    try {
      const { data: s, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) {
        setMsg(sessErr.message)
        return
      }

      const token = s.session?.access_token
      if (!token) {
        setMsg('ログインしてください（通報にはログインが必要です）')
        return
      }

      const reason = (prompt('通報理由（任意）') ?? '').trim()

      const res = await fetch('/api/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          // ✅ server 側は snake_case を推奨
          target_type: targetType,
          target_id: targetId,
          reason: reason || null,

          // ✅ 後方互換：既存の route が camelCase を見てても動くように残す
          targetType,
          targetId,

          // debug: true, // 切り分け中だけON（本番ではOFF）
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (res.status === 401) {
        setMsg(json?.error ?? 'ログインしてください')
        return
      }

      if (!res.ok || json?.ok === false) {
        setMsg(json?.error ?? '通報に失敗しました')
        return
      }

      setMsg('通報しました（運営が確認します）')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button
        onClick={report}
        disabled={loading}
        style={{
          border: '1px solid #ccc',
          borderRadius: 999,
          padding: '4px 10px',
          fontSize: 12,
          background: 'transparent',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '送信中…' : '通報'}
      </button>
      {msg && <span style={{ fontSize: 12, opacity: 0.75 }}>{msg}</span>}
    </span>
  )
}
