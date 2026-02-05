'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

type WorkType = 'novel' | 'manga' | 'game' | 'music' | 'video' | 'other'

const WORK_TYPES: { value: WorkType; label: string }[] = [
  { value: 'novel', label: '小説' },
  { value: 'manga', label: '漫画' },
  { value: 'game', label: 'ゲーム' },
  { value: 'music', label: '音楽' },
  { value: 'video', label: '動画' },
  { value: 'other', label: 'その他' },
]

const HOURS = [1, 3, 6, 12, 24, 48, 50, 72, 100] as const

export default function NewRoomPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [workType, setWorkType] = useState<WorkType>('novel')
  const [timeLimitHours, setTimeLimitHours] = useState<number>(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = useMemo(() => title.trim().length > 0 && !loading, [title, loading])

  const createRoom = async () => {
    setError('')
    const t = title.trim()
    if (!t) return

    setLoading(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setError('ログインしてください')
        return
      }

      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: t, workType, timeLimitHours }),
      })

      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? '作成に失敗しました')
        return
      }

      router.push(`/rooms/${json.room.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <p>
        <Link href="/rooms">← 一覧に戻る</Link>
      </p>

      <h1 style={{ marginTop: 8 }}>ルーム作成</h1>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>タイトル</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：30人で作る四コマ漫画"
          style={{
            width: '100%',
            border: '1px solid #ccc',
            borderRadius: 10,
            padding: '10px 12px',
          }}
        />
        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>最大60文字</div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>形式</label>
        <select
          value={workType}
          onChange={(e) => setWorkType(e.target.value as WorkType)}
          style={{
            width: '100%',
            border: '1px solid #ccc',
            borderRadius: 10,
            padding: '10px 12px',
          }}
        >
          {WORK_TYPES.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>制限時間</label>
        <select
          value={timeLimitHours}
          onChange={(e) => setTimeLimitHours(Number(e.target.value))}
          style={{
            width: '100%',
            border: '1px solid #ccc',
            borderRadius: 10,
            padding: '10px 12px',
          }}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}時間
            </option>
          ))}
        </select>

        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
          期限を過ぎると自動で forced_publish になります
        </div>
      </div>

      {error && <p style={{ color: '#b00020', marginTop: 12 }}>{error}</p>}

      <button
        onClick={createRoom}
        disabled={!canSubmit}
        style={{
          marginTop: 16,
          padding: '10px 14px',
          border: '1px solid #111',
          borderRadius: 10,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          background: '#111',
          color: '#fff',
          opacity: canSubmit ? 1 : 0.5,
        }}
      >
        {loading ? '作成中…' : '作成'}
      </button>
    </div>
  )
}
