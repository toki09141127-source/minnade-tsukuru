'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function DeleteAccountButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const onDelete = async () => {
    setMsg('')

    const ok = window.confirm(
      '本当に退会しますか？\n退会すると元に戻せません。'
    )
    if (!ok) return

    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setMsg('ログインしてください')
        return
      }

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setMsg(json?.error ?? '退会に失敗しました')
        return
      }

      // ローカルのセッションも消す
      await supabase.auth.signOut()

      alert('退会しました')
      router.push('/login')
    } catch (e: any) {
      setMsg(e?.message ?? '退会に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>退会</div>

      <button
        onClick={onDelete}
        disabled={loading}
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid rgba(239,68,68,0.6)',
          background: 'rgba(239,68,68,0.10)',
          color: '#7f1d1d',
          fontWeight: 900,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '処理中…' : 'アカウントを削除（退会）'}
      </button>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
        ※ 退会すると元に戻せません
      </div>

      {msg && <div style={{ marginTop: 8, fontSize: 12, color: '#b00020' }}>{msg}</div>}
    </div>
  )
}
