'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'
import ConfirmModal from '../../components/ConfirmModal'

export default function DeleteRoomButton(props: { roomId: string }) {
  const { roomId } = props
  const router = useRouter()

  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // ✅ iPhone対応：confirm()をやめて自前モーダルにする
  const [open, setOpen] = useState(false)

  const doDelete = async () => {
    if (loading) return
    setMsg(null)
    setLoading(true)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setMsg('ログインが必要です')
        return
      }

      const res = await fetch('/api/rooms/delete', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? 'delete failed')

      // 削除成功→一覧へ
      router.push('/rooms')
      router.refresh()
    } catch (e: any) {
      setMsg(e?.message ?? 'error')
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => {
          setMsg(null)
          setOpen(true)
        }}
        disabled={loading}
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid rgba(255,0,0,0.35)',
          background: 'rgba(255,0,0,0.08)',
          cursor: 'pointer',
          fontWeight: 900,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '削除中...' : '🗑️ ルームを削除'}
      </button>

      {msg && <p style={{ marginTop: 8, color: 'crimson', fontWeight: 700 }}>{msg}</p>}

      <ConfirmModal
        open={open}
        title="このルームを削除しますか？"
        description="削除（論理削除）すると元に戻せません。※ホストのみ実行できます。"
        confirmText="削除する"
        cancelText="キャンセル"
        danger
        loading={loading}
        onCancel={() => !loading && setOpen(false)}
        onConfirm={doDelete}
      />
    </div>
  )
}