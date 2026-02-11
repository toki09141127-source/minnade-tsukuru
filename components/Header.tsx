'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase/client'

export default function Header() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setIsLoggedIn(!!data.session)
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    // 表記切り替え最優先：まず即state更新（onAuthStateChangeでも来るが保険）
    setIsLoggedIn(false)

    await supabase.auth.signOut()

    // App Router遷移（location.hrefは使わない）
    router.replace('/')
    router.refresh()
  }

  return (
    <header className="header">
      <div className="headerInner">
        <Link href="/" className="brand">
          みんなで作ろう（仮）
        </Link>

        <nav className="nav">
          <Link href="/rooms" className="navBtn">
            制作ルーム一覧
          </Link>
          <Link href="/profile" className="navBtn">
            プロフィール
          </Link>
          <Link href="/rankings" className="navBtn">
            ランキング
          </Link>
          <Link href="/works" className="navBtn">
            完成作品
          </Link>
          <Link href="/terms" className="navBtn">
            利用規約
          </Link>

          {isLoggedIn ? (
            <button type="button" onClick={handleLogout} className="navBtn navBtnPrimary">
              ログアウト
            </button>
          ) : (
            <Link href="/login" className="navBtn navBtnPrimary">
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
