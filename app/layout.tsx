import './globals.css'
import type { ReactNode } from 'react'
import AuthHeader from '../components/AuthHeader'

export const metadata = {
  title: 'みんなで作ろう（仮）',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AuthHeader />
        <main>{children}</main>
      </body>
    </html>
  )
}
