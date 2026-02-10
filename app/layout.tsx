// app/layout.tsx
import './globals.css'
import Header from '@/components/Header'

export const metadata = {
  title: 'みんなで作ろう（仮）',
  description: 'みんなの創作でアイデアいっぱい！',
  icons: {
    icon: '/favicon-32x32.png',
  },
  openGraph: {
    images: ['/ogp.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Header />
        <main className="main">{children}</main>
      </body>
    </html>
  )
}
