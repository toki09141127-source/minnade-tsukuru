'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setIsLoggedIn(!!data.session)
    }
    init()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    location.href = '/'
  }

  return (
    <header className="header">
      <div className="headerInner">
        <Link href="/" className="brand">
          みんなで作ろう（仮）
        </Link>

        <nav className="nav">
          <Link href="/rooms" className="navBtn">制作ルーム一覧</Link>
          <Link href="/profile" className="navBtn">プロフィール</Link>
          <Link href="/rankings" className="navBtn">ランキング</Link>
          <Link href="/works" className="navBtn">完成作品</Link>
          <Link href="/terms" className="navBtn">利用規約</Link>

          {/* ログイン状態で出し分け */}
          {isLoggedIn === null ? null : isLoggedIn ? (
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
