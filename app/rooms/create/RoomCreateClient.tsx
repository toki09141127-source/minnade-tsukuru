'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '小説', label: '小説' },
  { value: '漫画', label: '漫画' },
  { value: 'アニメ', label: 'アニメ' },
  { value: 'ゲーム', label: 'ゲーム' },
  { value: 'イラスト', label: 'イラスト' },
  { value: '音楽', label: '音楽' },
  { value: '動画', label: '動画' },
  { value: 'その他', label: 'その他' },
]

const HOUR_PRESETS = [6, 12, 24, 48, 72, 100, 150]

export default function RoomCreateClient() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('その他')
  const [isAdult, setIsAdult] = useState(false)
  const [hours, setHours] = useState<number>(48)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hoursLabel = useMemo(() => {
    const n = Math.max(1, Math.min(150, Math.floor(Number(hours) || 48)))
    const d = Math.floor(n / 24)
    const h = n % 24
    if (d <= 0) return `${n}時間`
    if (h === 0) return `${d}日（${n}時間）`
    return `${d}日 + ${h}時間（${n}時間）`
  }, [hours])

  const submit = async () => {
    if (loading) return
    setError('')

    const t = title.trim()
    if (!t) {
      setError('タイトルを入力してください')
      return
    }

    const hoursNum = Math.max(1, Math.min(150, Math.floor(Number(hours) || 48)))

    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setError('Not authenticated')
        return
      }

      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: t,
          type: 'novel',
          category,
          isAdult,
          hours: hoursNum,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? `作成に失敗しました (status=${res.status})`)
        return
      }

      const roomId = json?.room?.id
      if (roomId) router.push(`/rooms/${roomId}`)
      else router.push('/rooms')
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 18,
        padding: 16,
        background: 'rgba(255,255,255,0.85)',
      }}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 800 }}>タイトル</label>
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
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 800 }}>カテゴリ</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.2)',
              }}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 800 }}>対象</label>
            <select
              value={String(isAdult)}
              onChange={(e) => setIsAdult(e.target.value === 'true')}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.2)',
              }}
            >
              <option value="false">一般向け</option>
              <option value="true">成人向け</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 800 }}>
            制限時間（1〜150時間） <span style={{ fontWeight: 700, opacity: 0.75 }}>：{hoursLabel}</span>
          </label>

          <input
            type="number"
            min={1}
            max={150}
            step={1}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.2)',
              marginBottom: 10,
            }}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HOUR_PRESETS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(h)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(0,0,0,0.18)',
                  background: 'rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {h}時間
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
            例：48=2日 / 72=3日 / 150=6日と6時間
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 900,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '作成中…' : 'ルームを作成'}
          </button>

          {error && <span style={{ color: '#b00020', fontWeight: 800 }}>{error}</span>}
        </div>
      </div>
    </div>
  )
}
