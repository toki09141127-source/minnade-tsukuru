'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = { roomId: string }

export default function InviteCodeForCreator({ roomId }: Props) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [enable, setEnable] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [err, setErr] = useState<string>('')

  const [copyMsg, setCopyMsg] = useState('')
  const [copyBusy, setCopyBusy] = useState(false)

  const canCopy = useMemo(() => !!code && !!code.trim(), [code])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setErr('')
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (!token) {
          // 未ログインなら何も出さない（詳細ページの他要素でログイン誘導する想定）
          return
        }

        const res = await fetch(`/api/rooms/${roomId}/invite-code`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        })

        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          // 403=制作者以外：黙って非表示
          if (res.status === 403) return
          setErr(json?.error ?? `取得に失敗しました (status=${res.status})`)
          return
        }

        setEnable(Boolean(json?.enable))
        setCode((json?.code ?? null) as string | null)
      } catch (e: any) {
        setErr(e?.message ?? '取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const copy = async () => {
    if (!canCopy || copyBusy) return
    setCopyBusy(true)
    setCopyMsg('')
    const v = (code ?? '').trim()

    try {
      await navigator.clipboard.writeText(v)
      setCopyMsg('コピーしました！')
    } catch {
      const manual = window.prompt('コピーに失敗しました。手動でコピーしてください：', v)
      if (manual !== null) setCopyMsg('手動コピー用に表示しました')
      else setCopyMsg('コピーできませんでした（ブラウザ制限の可能性）')
    } finally {
      setCopyBusy(false)
      setTimeout(() => setCopyMsg(''), 2500)
    }
  }

  // ローディング中は場所を取らない
  if (loading) return null

  // 制作者だけがここに到達する想定（403はreturn）
  if (err) {
    return (
      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)' }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>招待コード（制作者のみ）</div>
        <div style={{ color: '#b00020', fontSize: 13 }}>{err}</div>
      </div>
    )
  }

  if (!enable) return null

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.12)',
        background: 'rgba(0,0,0,0.02)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ fontWeight: 900 }}>招待コード（制作者のみ）</div>
        <button
          type="button"
          onClick={copy}
          disabled={!canCopy || copyBusy}
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.2)',
            background: '#111',
            color: '#fff',
            cursor: copyBusy ? 'not-allowed' : 'pointer',
            fontWeight: 900,
            opacity: copyBusy ? 0.6 : 1,
          }}
        >
          {copyBusy ? 'コピー中…' : 'コピー'}
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <input
          value={code ?? ''}
          readOnly
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.2)',
            background: '#fff',
            fontWeight: 900,
            letterSpacing: 1,
          }}
        />
      </div>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, lineHeight: 1.6 }}>
        この招待コードを知っている人は「招待コードでcore参加」から即coreになれます。
      </div>

      {copyMsg && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: 900,
            background: 'rgba(0,0,0,0.04)',
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {copyMsg}
        </div>
      )}
    </div>
  )
}
