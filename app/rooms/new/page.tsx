// app/rooms/new/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORY_OPTIONS = [
  '漫画',
  'アニメ',
  '小説',
  'イラスト',
  'ゲーム',
  '脚本',
  '音楽',
  '映像',
  'その他',
] as const

const AUDIENCE_OPTIONS = [
  { value: 'general', label: '一般向け' },
  { value: 'adult', label: '成人向け' },
] as const

const DURATION_OPTIONS = [
  { minutes: 30, label: '30分' },
  { minutes: 60, label: '1時間' },
  { minutes: 90, label: '1時間30分' },
  { minutes: 120, label: '2時間' },
  { minutes: 180, label: '3時間' },
  { minutes: 360, label: '6時間' },
  { minutes: 720, label: '12時間' },
  { minutes: 1440, label: '24時間' },
] as const

export default function NewRoomPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('小説')
  const [audience, setAudience] = useState<(typeof AUDIENCE_OPTIONS)[number]['value']>('general')
  const [durationMin, setDurationMin] = useState<number>(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (loading) return
    setError('')
    const t = title.trim()
    if (!t) {
      setError('タイトルを入力してください')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t,
          category,
          audience,
          duration_minutes: durationMin,
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
    } catch (e: any) {
      setError(e?.message ?? '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1 className="h1">ルームを作成</h1>

      <div className="card" style={{ padding: 16 }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>タイトル</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：短編小説を完成させる"
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--fg)',
          }}
        />

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
          <div style={{ flex: '1 1 240px' }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>カテゴリー</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--fg)',
              }}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 240px' }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>対象</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as any)}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--fg)',
              }}
            >
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <p className="mutedLine" style={{ marginTop: 6 }}>
              ※ 成人向けは一覧フィルタで分けられます
            </p>
          </div>

          <div style={{ flex: '1 1 240px' }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>制限時間</label>
            <select
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--fg)',
              }}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.minutes} value={d.minutes}>
                  {d.label}
                </option>
              ))}
            </select>
            <p className="mutedLine" style={{ marginTop: 6 }}>
              ※ 期限になると forced_publish で自動公開されます
            </p>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={submit}
            disabled={loading}
            className="btnPrimary"
            style={{ borderRadius: 12 }}
          >
            {loading ? '作成中…' : '作成する'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/rooms')}
            className="btnGhost"
            style={{ borderRadius: 12 }}
          >
            キャンセル
          </button>
        </div>

        {error && <p style={{ color: '#b00020', marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  )
}
