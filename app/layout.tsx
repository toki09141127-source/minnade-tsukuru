// app/layout.tsx
import './globals.css'
import Header from '@/components/Header'
import TermsConsentGate from '@/components/TermsConsentGate'
import type { Metadata } from 'next'

const ICON_VERSION = '2026-03-05'

export const metadata: Metadata = {
  metadataBase: new URL('https://minnade-tsukuru.vercel.app'),

  title: {
    default: 'みんなで作ろう（仮）',
    template: '%s | みんなで作ろう（仮）',
  },

  description:
    'みんなの創作でアイデアいっぱい！最大50人で共同制作できるクリエイター向けサイト。',

  icons: {
    icon: [
      {
        url: `/favicon.ico?v=${ICON_VERSION}`,
      },
      {
        url: `/icon.png?v=${ICON_VERSION}`,
        type: 'image/png',
      },
    ],

    apple: [
      {
        url: `/apple-icon.png?v=${ICON_VERSION}`,
      },
    ],

    shortcut: [`/favicon.ico?v=${ICON_VERSION}`],
  },

  openGraph: {
    title: 'みんなで作ろう（仮）',
    description:
      '最大50人で共同制作。制限時間付きの創作ルームで、みんなのアイデアを形に。',
    url: 'https://minnade-tsukuru.vercel.app',
    siteName: 'みんなで作ろう（仮）',

    images: [
      {
        url: '/ogp.png',
        width: 1200,
        height: 630,
        alt: 'みんなで作ろう（仮）',
      },
    ],

    locale: 'ja_JP',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'みんなで作ろう（仮）',
    description: '最大50人で共同制作できる創作プラットフォーム。',
    images: ['/ogp.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <Header />
        <TermsConsentGate />
        <main className="main">{children}</main>
      </body>
    </html>
  )
}