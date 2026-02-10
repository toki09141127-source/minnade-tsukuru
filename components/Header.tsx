'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Header() {
  const supabase = createClient()
  const router = useRouter()

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  // セッション取得
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      setIsLoggedIn(!!data.session)
    }

    getSession()

    // ログイン状態変化監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
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

          {/* ← ここが今回の核心 */}
          {isLoggedIn === null ? null : isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
            >
              ログアウト
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
            >
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
