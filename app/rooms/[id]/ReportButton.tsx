// app/rooms/[id]/ReportButton.tsx
'use client'
import SupportContact from '@/components/SupportContact'

import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function ReportButton({
  targetType,
  targetId,
}: {
  targetType: 'room' | 'post'
  targetId: string
}) {
  const pendingRequest = useRef<{key:string;id:string}|null>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [category,setCategory] = useState('個人情報')
  const [msg, setMsg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setReason('')
    setError('')
    setMsg('')
    setLoading(false)
  }

  const onOpen = () => {
    reset()
    setOpen(true)
  }

  const onClose = () => {
    setOpen(false)
    reset()
  }

  const submit = async () => {
    setMsg('')
    setError('')

    const r = reason.trim()
    if (!r) {
      setError('通報理由を入力してください')
      return
    }

    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setError('ログインしてください')
        return
      }

      const key=JSON.stringify([s.session?.user.id,targetType,targetId,category,r])
      if(pendingRequest.current?.key!==key) pendingRequest.current={key,id:crypto.randomUUID()}
      const res = await fetch('/api/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: pendingRequest.current.id,
          targetType,
          targetId,
          reason: '[' + category + '] ' + r, // ✅ 必ずtrim済み文字列を送る
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json?.ok) {
        setError(json?.error ?? '通報に失敗しました')
        return
      }

      pendingRequest.current=null
      setMsg('通報を受け付けました（運営が確認します）')
      // 送信成功したら閉じる（メッセージだけ残したいなら close しない運用もOK）
      setOpen(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '通報に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', maxWidth: '100%' }}>
      <button
        onClick={onOpen}
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

      {(msg || error) && (
        <span style={{ fontSize: 12, opacity: 0.85, color: error ? '#b00020' : undefined }}>
          {error || msg}
        </span>
      )}

      {open && (
        <div
          style={{
            marginLeft: 8,
            padding: 12,
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.15)',
            background: '#fff',
            width: 'min(360px, 100%)', minWidth: 0,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
            通報理由（必須）
          </div>

          <label>分類<select value={category} onChange={e=>setCategory(e.target.value)}>{['個人情報','無断転載・著作権','誹謗中傷','不適切内容','その他'].map(value=><option key={value}>{value}</option>)}</select></label>
          <textarea
            aria-label="通報の詳細"
            maxLength={1900}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="例）誹謗中傷、スパム、無断転載、迷惑行為 など"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 10,
              border: `1px solid ${error ? '#b00020' : 'rgba(0,0,0,0.2)'}`,
              resize: 'vertical',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={submit}
              disabled={loading}
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid #111',
                background: '#111',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 800,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '送信中…' : '送信'}
            </button>

            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.2)',
                background: 'transparent',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 700,
                opacity: loading ? 0.7 : 1,
              }}
            >
              キャンセル
            </button>
          </div>

          <p style={{fontSize:12}}><SupportContact /></p>
          {error && <div style={{ marginTop: 8, color: '#b00020', fontSize: 12 }}>{error}</div>}
        </div>
      )}
    </span>
  )
}
