// app/components/AgeGate.tsx
'use client'

import { useEffect, useState } from 'react'

const KEY = 'age_ok_v1'

export function useAgeOk() {
  const [ok, setOk] = useState(false)

  useEffect(() => {
    try {
      setOk(localStorage.getItem(KEY) === '1')
    } catch {
      setOk(false)
    }
  }, [])

  const accept = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {}
    setOk(true)
  }

  return { ok, accept }
}

export default function AgeGate({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="ageGate">
      <div className="ageGateCard">
        <h3>成人向けコンテンツの表示</h3>
        <p className="muted">
          18歳未満の方は閲覧できません。表示して良い場合のみ続行してください。
        </p>
        <button className="btn" onClick={onAccept}>
          表示する（18歳以上）
        </button>
      </div>
    </div>
  )
}
