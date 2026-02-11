'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase/client'

export default function Header() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loadingAuth, setLoadingAuth] = useState(true)

  // ✅ render毎にcreateClientしない（supabaseは module-scope の singleton を使う想定）
  // ただし「依存を明確にする」ために useMemo で固定参照してもOK（最小改修）
  const sb = useMemo(() => supabase, [])

  useEffect(() => {
    let mounted = true

    // 初期状態
    const init = async () => {
      try {
        const { data } = await sb.auth.getSession()
        if (!mounted) return
        setIsLoggedIn(!!data.session)
      } finally {
        if (mounted) setLoadingAuth(false)
      }
    }

    init()

    // ✅ 認証状態の変化を購読
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })

    // ✅ cleanup
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [sb])

  const handleLogout = async () => {
    // ✅ 表示切替を最優先で即反映（signOut結果を待たない）
    setIsLoggedIn(false)

    const { error } = await sb.auth.signOut()
    if (error) {
      // signOut 失敗時は表示を戻す（最低限）
      setIsLoggedIn(true)
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid #eee',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/" style={{ fontWeight: 700 }}>
          みんなで作ろう（仮）
        </Link>
        <Link href="/rooms" style={{ color: '#333' }}>
          ルーム一覧
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* ✅ 初期判定中のチラつき防止（最小） */}
        {loadingAuth ? (
          <span style={{ fontSize: 12, color: '#666' }}>…</span>
        ) : isLoggedIn ? (
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '8px 12px',
              border: '1px solid #111',
              borderRadius: 10,
              background: '#111',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        ) : (
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              padding: '8px 12px',
              border: '1px solid #111',
              borderRadius: 10,
              background: '#111',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            ログイン
          </Link>
        )}
      </div>
    </header>
  )
}
