'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase/client'

// ✅ supabase は module-scope の singleton を使う（render毎にcreateClientしない）
const sb = supabase

export default function Header() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    let mounted = true

    // ✅ 初期状態：getSession() で決める
    const init = async () => {
      const { data } = await sb.auth.getSession()
      if (!mounted) return
      setIsLoggedIn(!!data.session)
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
  }, [])

  const handleLogout = async () => {
    // ✅ 表記切替が最優先：押下直後に即反映
    setIsLoggedIn(false)

    const { error } = await sb.auth.signOut()
    if (error) {
      // 失敗時は戻す（最小）
      setIsLoggedIn(true)
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <header className="header">
      <div className="headerInner">
        {/* 左：ロゴ */}
        <Link href="/" className="navBtn">
          みんなで作ろう（仮）
        </Link>

        {/* 中央：ナビ（並びは固定） */}
        <nav className="nav">
          <Link href="/rooms" className="navBtn">
            制作ルーム一覧
          </Link>
          <Link href="/profile" className="navBtn">
            プロフィール
          </Link>
          <Link href="/ranking" className="navBtn">
            ランキング
          </Link>
          <Link href="/works" className="navBtn">
            完成作品
          </Link>
          <Link href="/terms" className="navBtn">
            利用規約
          </Link>
        </nav>

        {/* 右端：ログイン or ログアウト（並びは固定） */}
        {isLoggedIn ? (
          <button type="button" className="navBtn" onClick={handleLogout}>
            ログアウト
          </button>
        ) : (
          <Link href="/login" className="navBtn">
            ログイン
          </Link>
        )}
      </div>
    </header>
  )
}
