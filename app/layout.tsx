// app/layout.tsx
import './globals.css'
import Link from 'next/link'
import { ReactNode } from 'react'

export const metadata = {
  title: 'みんなで作ろう（仮）',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* 共通ヘッダー */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            position: 'sticky',
            top: 0,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            zIndex: 50,
          }}
        >
          <Link href="/" style={{ textDecoration: 'none', color: '#111' }}>
            <strong>みんなで作ろう（仮）</strong>
          </Link>

          <nav style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {/* ✅ ここが最重要：必ず /rooms */}
            <Link href="/rooms" prefetch={false}>
              制作ルーム一覧
            </Link>
            <Link href="/profile" prefetch={false}>
              プロフィール
            </Link>
          </nav>
        </header>

        <main>{children}</main>
      </body>
    </html>
  )
}
