'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

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

const CONCEPT_MAX = 300

export default function RoomCreateClient() {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('その他')
  const [isAdult, setIsAdult] = useState(false)
  const [hours, setHours] = useState<number>(48)

  // ✅ 追加：コンセプト
  const [concept, setConcept] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const conceptLen = concept.length
  const conceptTooLong = conceptLen > CONCEPT_MAX

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && !loading && !conceptTooLong
  }, [title, loading, conceptTooLong])

  const submit = async () => {
    const t = title.trim()
    if (!t) return

    // ✅ クライアント側でも弾く（API側でも弾くので二重）
    const c = concept.trim()
    if (c.length > CONCEPT_MAX) {
      setError(`コンセプトは${CONCEPT_MAX}文字以内で入力してください`)
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr) {
        setError(sessionErr.message)
        return
      }

      const token = sessionData.session?.access_token
      if (!token) {
        setError('ログインしてください')
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
          // ✅ 追加：concept
          concept: c || null,
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
    <div style={{ maxWidth: 820, margin: '24px auto', padding: '0 16px' }}>
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
          required
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
            background: '#fff',
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
            background: '#fff',
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
          onChange={(e) => setHours(Number(e.target.value))}
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

        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 14 }}>1〜150時間まで設定できます（例：48 = 2日）</div>

        {/* ✅ 追加：作品コンセプト */}
        <div style={{ marginTop: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 800 }}>
              作品コンセプト（任意）
            </label>
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              {conceptLen}/{CONCEPT_MAX}
            </span>
          </div>

          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8, lineHeight: 1.6 }}>
            このルームで作りたい作品のイメージを自由に書いてください（例：雰囲気、ジャンル、主人公、やりたい演出など）
          </div>

          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder={
              '例）雰囲気：青春 × SF\n' +
              '主人公：気弱だけど芯がある\n' +
              '展開：最初は日常→後半で一気に正体が明かされる\n' +
              'NG：グロは無し'
            }
            rows={5}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${conceptTooLong ? '#b00020' : 'rgba(0,0,0,0.2)'}`,
              background: '#fff',
              resize: 'vertical',
              lineHeight: 1.6,
              wordBreak: 'break-word',
            }}
          />

          {conceptTooLong && (
            <div style={{ marginTop: 8, color: '#b00020', fontSize: 12 }}>
              コンセプトは{CONCEPT_MAX}文字以内で入力してください
            </div>
          )}
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
