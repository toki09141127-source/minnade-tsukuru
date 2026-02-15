'use client'

import { useMemo, useState, useEffect } from 'react'
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

// 招待コード生成：8桁英数字（I/O/1/0 を避けて読みやすく）
function generateInviteCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 chars
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export default function RoomCreateClient() {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('その他')
  const [isAdult, setIsAdult] = useState(false)
  const [hours, setHours] = useState<number>(48)

  // ✅ 追加：コンセプト
  const [concept, setConcept] = useState('')

  // ✅ 追加：core参加方式
  // 承認制はデフォルト true（あなたの仕様の推奨）
  const [enableCoreApproval, setEnableCoreApproval] = useState(true)
  const [enableCoreInvite, setEnableCoreInvite] = useState(false)
  const [coreInviteCode, setCoreInviteCode] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const conceptLen = concept.length
  const conceptTooLong = conceptLen > CONCEPT_MAX

  // 招待コードONにした瞬間に自動生成（空なら）
  useEffect(() => {
    if (enableCoreInvite && !coreInviteCode) {
      setCoreInviteCode(generateInviteCode(8))
    }
    if (!enableCoreInvite) {
      // OFFなら null 保存したいので、クライアント上は空に戻してOK
      setCoreInviteCode('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableCoreInvite])

  const inviteCodeInvalid = useMemo(() => {
    if (!enableCoreInvite) return false
    const code = coreInviteCode.trim()
    if (!code) return true
    if (code.length < 6 || code.length > 32) return true
    if (!/^[A-Z0-9]+$/.test(code)) return true
    return false
  }, [enableCoreInvite, coreInviteCode])

  const canSubmit = useMemo(() => {
    const tOk = title.trim().length > 0
    return tOk && !loading && !conceptTooLong && !inviteCodeInvalid
  }, [title, loading, conceptTooLong, inviteCodeInvalid])

  const submit = async () => {
    const t = title.trim()
    if (!t) return

    // ✅ クライアント側でも弾く（API側でも弾くので二重）
    const c = concept.trim()
    if (c.length > CONCEPT_MAX) {
      setError(`コンセプトは${CONCEPT_MAX}文字以内で入力してください`)
      return
    }

    // ✅ 招待コードONなら必須
    const inviteCode = coreInviteCode.trim()
    if (enableCoreInvite && inviteCodeInvalid) {
      setError('招待コードが不正です（英数字・6〜32文字）')
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

          // ✅ 既存：concept
          concept: c || null,

          // ✅ 追加：core参加方式
          enable_core_approval: !!enableCoreApproval,
          enable_core_invite: !!enableCoreInvite,
          core_invite_code: enableCoreInvite ? inviteCode : null,
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

        {/* ✅ 追加：コア参加方式 */}
        <div style={{ marginTop: 10, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>コア参加の設定</div>

          {/* 承認制 */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <input
              id="enableCoreApproval"
              type="checkbox"
              checked={enableCoreApproval}
              onChange={(e) => setEnableCoreApproval(e.target.checked)}
            />
            <label htmlFor="enableCoreApproval" style={{ fontWeight: 800 }}>
              コア参加：承認制を有効にする
            </label>
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12, lineHeight: 1.6 }}>
            ON：ユーザーは「コア申請」→制作者が承認すると core になります。
          </div>

          {/* 招待コード */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <input
              id="enableCoreInvite"
              type="checkbox"
              checked={enableCoreInvite}
              onChange={(e) => setEnableCoreInvite(e.target.checked)}
            />
            <label htmlFor="enableCoreInvite" style={{ fontWeight: 800 }}>
              招待コード枠を有効にする（入力で即core）
            </label>
          </div>

          {enableCoreInvite && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: '#fafafa', border: '1px solid rgba(0,0,0,0.10)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ fontWeight: 900 }}>招待コード</div>
                <button
                  type="button"
                  onClick={() => setCoreInviteCode(generateInviteCode(8))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(0,0,0,0.2)',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  再生成
                </button>
              </div>

              <input
                value={coreInviteCode}
                onChange={(e) => setCoreInviteCode(e.target.value.toUpperCase())}
                placeholder="例：ABCD1234"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${inviteCodeInvalid ? '#b00020' : 'rgba(0,0,0,0.2)'}`,
                  marginTop: 10,
                  background: '#fff',
                  fontWeight: 900,
                  letterSpacing: 1,
                }}
              />

              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8, lineHeight: 1.6 }}>
                招待コードを知っている人は「招待コードでcore参加」から即coreになれます（最大5人枠）。
              </div>

              {inviteCodeInvalid && (
                <div style={{ marginTop: 8, color: '#b00020', fontSize: 12 }}>
                  招待コードが不正です（英数字・6〜32文字）
                </div>
              )}
            </div>
          )}
        </div>

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
