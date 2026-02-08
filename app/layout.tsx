// app/layout.tsx
import './globals.css'
import Link from 'next/link'
import LogoutButton from './components/LogoutButton'

export const metadata = {
  title: 'みんなで作ろう（仮）',
  description: '創作ルームで一緒に作る',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="header">
          <div className="headerInner">
            {/* ★ここ：トップへ */}
            <Link href="/" className="brand">
              みんなで作ろう（仮）
            </Link>

            <nav className="nav">
              <Link href="/rooms" className="navLink">制作ルーム一覧</Link>
              <Link href="/profile" className="navLink">プロフィール</Link>
              <Link href="/rankings" className="navLink">ランキング</Link>
              <Link href="/works" className="navLink">完成作品</Link>
              <Link href="/terms" className="navLink">利用規約</Link>
              <LogoutButton />
            </nav>
          </div>
        </header>

        <main className="main">{children}</main>
      </body>
    </html>
  )
}
