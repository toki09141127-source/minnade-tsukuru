'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setIsLoggedIn(!!data.session)
    }
    init()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    location.href = '/'
  }

  const navBtn =
    'px-3 py-1.5 rounded-md text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition'

  return (
    <header className="border-b bg-white">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">

        {/* ロゴ */}
        <Link href="/" className="text-lg font-bold">
          みんなで作ろう（仮）
        </Link>

        {/* ナビ */}
        <nav className="flex items-center gap-2">

          <Link href="/rooms" className={navBtn}>
            制作ルーム一覧
          </Link>

          <Link href="/profile" className={navBtn}>
            プロフィール
          </Link>

          <Link href="/rankings" className={navBtn}>
            ランキング
          </Link>

          <Link href="/works" className={navBtn}>
            完成作品
          </Link>

          <Link href="/terms" className={navBtn}>
            利用規約
          </Link>

          {/* ログイン状態で切替 */}
          {isLoggedIn === null ? null : isLoggedIn ? (
            <button onClick={handleLogout} className={navBtn}>
              ログアウト
            </button>
          ) : (
            <Link href="/login" className={navBtn}>
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
