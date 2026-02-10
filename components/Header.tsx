// components/Header.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      setIsLoggedIn(!!data.session)
    }
    check()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    location.reload()
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-bold text-lg">
          みんなで作ろう（仮）
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/rooms">制作ルーム一覧</Link>
          <Link href="/profile">プロフィール</Link>
          <Link href="/ranking">ランキング</Link>
          <Link href="/works">完成作品</Link>
          <Link href="/terms">利用規約</Link>

          {isLoggedIn === null ? null : isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
            >
              ログイン/ログアウト
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
            >
              ログイン/ログアウト
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
