// app/layout.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import LogoutButton from './components/LogoutButton'

export const metadata: Metadata = {
  title: 'みんなで作ろう（仮）',
  description: '時間制限つき共同創作サービス',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid #eee',
          }}
        >
          <div style={{ fontWeight: 700 }}>
            <Link href="/rooms" style={{ color: 'inherit', textDecoration: 'none' }}>
              みんなで作ろう（仮）
            </Link>
          </div>

          <nav style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Link href="/rooms" style={{ textDecoration: 'none' }}>
              制作ルーム一覧
            </Link>
            <Link href="/profile" style={{ textDecoration: 'none' }}>
              プロフィール
            </Link>
            <Link href="/rankings" style={{ textDecoration: 'none' }}>
              ランキング
            </Link>
            <Link href="/works" style={{ textDecoration: 'none' }}>
              完成作品
            </Link>

            {/* ✅ ログアウトボタン復活 */}
            <LogoutButton />
          </nav>
        </header>

        <main>{children}</main>
      </body>
    </html>
  )
}
