'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function ReportButton(props: { targetType: 'room' | 'post'; targetId: string }) {
  const { targetType, targetId } = props
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('荒らし/迷惑行為')
  const [detail, setDetail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setMsg(null)
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setMsg('ログインが必要です')
        return
      }

      const res = await fetch('/api/reports/create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          detail,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'report failed')

      setMsg('送信しました。対応が必要な場合は運営が確認します。')
      setDetail('')
      setOpen(false)
    } catch (e: any) {
      setMsg(e?.message ?? 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid rgba(0,0,0,0.15)',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        🚨 通報
      </button>

      {open && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.12)',
            background: 'rgba(0,0,0,0.03)',
            lineHeight: 1.7,
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontWeight: 700 }}>理由</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
              <option>荒らし/迷惑行為</option>
              <option>誹謗中傷</option>
              <option>成人向け/不適切</option>
              <option>著作権/転載は禁止の疑い</option>
              <option>その他</option>
            </select>
          </div>

          <div style={{ marginTop: 10 }}>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="詳細（任意）"
              rows={3}
              style={{ width: '100%', padding: 10, borderRadius: 10 }}
            />
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={submit}
              disabled={loading}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.15)',
                cursor: 'pointer',
                fontWeight: 800,
              }}
            >
              {loading ? '送信中...' : '送信'}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.15)',
                cursor: 'pointer',
              }}
            >
              閉じる
            </button>
          </div>

          {msg && <p style={{ margin: '10px 0 0 0', color: '#b00', fontWeight: 700 }}>{msg}</p>}
        </div>
      )}
    </div>
  )
}
