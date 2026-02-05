import './globals.css'
import AuthHeader from '../components/AuthHeader'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AuthHeader />
        {children}
      </body>
    </html>
  )
}
