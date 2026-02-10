'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '小説', label: '小説' },
  { value: '漫画', label: '漫画' },
  { value: 'アニメ', label: 'アニメ' },
  { value: 'イラスト', label: 'イラスト' },
  { value: 'ゲーム', label: 'ゲーム' },
  { value: '企画', label: '企画' },
  { value: '雑談', label: '雑談' },
  { value: 'その他', label: 'その他' },
]

const PRESET_HOURS = [1, 3, 6, 12, 24, 36, 48, 72, 100, 120, 150] as const

export default function RoomCreateClient() {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('その他')
  const [isAdult, setIsAdult] = useState(false)
  const [hours, setHours] = useState<number>(48)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = useMemo(() => title.trim().length > 0 && !loading, [title, loading])

  const submit = async () => {
    const t = title.trim()
    if (!t) return

    setLoading(true)
    setError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setError('ログインしてください')
        setLoading(false)
        return
      }

      const h = Math.max(1, Math.min(150, Math.floor(Number(hours) || 1)))

      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: t,
          category,
          isAdult,
          hours: h,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(json?.error ?? `作成に失敗しました (status=${res.status})`)
        setLoading(false)
        return
      }

      const roomId = json?.room?.id
      if (roomId) router.push(`/rooms/${roomId}`)
      else router.push('/rooms')
    } catch (e: any) {
      setError(e?.message ?? '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleHoursChange = (v: number) => {
    if (Number.isNaN(v)) return
    setHours(Math.max(1, Math.min(150, v)))
  }

  return (
    <div style={{ maxWidth: 820, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>ルーム作成</h1>
        <Link href="/rooms" style={{ textDecoration: 'none' }}>← ルーム一覧へ</Link>
      </div>

      <div
        style={{
          marginTop: 16,
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 16,
          padding: 16,
          background: 'rgba(255,255,255,0.8)',
        }}
      >
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>タイトル</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="例：少年漫画のネーム作る"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.2)',
            marginBottom: 14,
          }}
        />

        <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>カテゴリ</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.2)',
            marginBottom: 14,
          }}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>対象</label>
        <select
          value={String(isAdult)}
          onChange={(e) => setIsAdult(e.target.value === 'true')}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.2)',
            marginBottom: 14,
          }}
        >
          <option value="false">一般向け</option>
          <option value="true">成人向け</option>
        </select>

        <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>制限時間（時間）</label>

        <input
          type="number"
          min={1}
          max={150}
          step={1}
          value={hours}
          onChange={(e) => handleHoursChange(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.2)',
            marginBottom: 10,
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {PRESET_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.2)',
                background: h === hours ? '#111' : 'transparent',
                color: h === hours ? '#fff' : '#111',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {h}h
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 14 }}>
          1〜150時間まで設定できます（例：48 = 2日）
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontWeight: 800,
            opacity: canSubmit ? 1 : 0.6,
          }}
        >
          {loading ? '作成中…' : 'ルームを作成'}
        </button>

        {error && <p style={{ color: '#b00020', marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  )
}
