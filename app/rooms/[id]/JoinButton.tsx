// app/rooms/[id]/JoinButton.tsx
'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

export default function JoinButton({
  roomId,
  roomStatus,
  onJoined,
}: {
  roomId: string
  roomStatus: string
  onJoined?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const join = async () => {
    if (loading) return
    if (roomStatus !== 'open') {
      setError('このルームは open ではありません')
      return
    }

    setLoading(true)
    setError('')
    setInfo('参加処理を開始…')

    try {
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) {
        setError(sessErr.message)
        return
      }

      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setError('Not authenticated（セッションが取れません）')
        return
      }

      setInfo('API呼び出し中…')

      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ roomId }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(json?.error ?? `参加に失敗しました (status=${res.status})`)
        return
      }

      setInfo('参加成功。画面を更新します…')

      // ✅ 参加後は表示（掲示板/参加状態）が変わるので確実に更新
      onJoined?.()
      window.location.reload()
    } catch (e: any) {
      setError(e?.message ?? '参加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={join}
        disabled={loading || roomStatus !== 'open'}
        style={{
          padding: '10px 16px',
          borderRadius: 10,
          border: '1px solid #111',
          background: '#111',
          color: '#fff',
          cursor: loading || roomStatus !== 'open' ? 'not-allowed' : 'pointer',
          opacity: loading || roomStatus !== 'open' ? 0.6 : 1,
        }}
      >
        {loading ? '参加中…' : '参加する'}
      </button>

      {/* ✅ これで「何も起きない」を絶対に防ぐ */}
      {info && <p style={{ marginTop: 8, fontSize: 12, color: '#555' }}>{info}</p>}
      {error && <p style={{ color: '#b00020', marginTop: 8 }}>{error}</p>}
    </div>
  )
}
