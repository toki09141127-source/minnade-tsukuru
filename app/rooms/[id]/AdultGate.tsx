'use client'

import { useEffect, useMemo, useState } from 'react'

export default function AdultGate(props: { isAdult: boolean }) {
  const { isAdult } = props
  const [ok, setOk] = useState(false)

  const storageKey = useMemo(() => 'minnade_adult_ok_v1', [])

  useEffect(() => {
    if (!isAdult) {
      setOk(true)
      return
    }
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null
    setOk(v === '1')
  }, [isAdult, storageKey])

  if (!isAdult) return null
  if (ok) return null

  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 10,
        border: '1px solid rgba(255, 99, 132, 0.35)',
        background: 'rgba(255, 99, 132, 0.08)',
        lineHeight: 1.7,
      }}
    >
      <p style={{ margin: 0, fontWeight: 800 }}>⚠️ このルームは「成人向け」設定です</p>
      <p style={{ margin: '8px 0 0 0' }}>
        18歳未満の方は閲覧できません。該当しない場合のみ下のボタンを押してください（確認は端末に保存されます）。
      </p>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            window.localStorage.setItem(storageKey, '1')
            setOk(true)
          }}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          18歳以上です（閲覧する）
        </button>

        <a href="/" style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.15)' }}>
          トップに戻る
        </a>
      </div>
    </div>
  )
}
