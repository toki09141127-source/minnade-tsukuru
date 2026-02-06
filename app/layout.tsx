// app/layout.tsx
import './globals.css'
import Link from 'next/link'
import { ReactNode } from 'react'
import AuthHeader from '../components/AuthHeader'

export const metadata = {
  title: 'みんなで作ろう（仮）',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* ログイン状態も見えるヘッダー */}
        <AuthHeader />

        {/* 共通ナビ */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 18px',
            borderBottom: '1px solid #eee',
          }}
        >
          <Link href="/" style={{ textDecoration: 'none', color: '#111' }}>
            <strong>みんなで作ろう（仮）</strong>
          </Link>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Link href="/">制作ルーム一覧</Link>
            <Link href="/rooms/new">ルーム作成</Link>
            <Link href="/profile">プロフィール</Link>
          </div>
        </div>

        <main>{children}</main>
      </body>
    </html>
  )
}
