import SupportContact from "@/components/SupportContact";
import LegalLinks from "@/components/LegalLinks";
// app/layout.tsx
import "./globals.css";
import Header from "@/components/Header";
import TermsConsentGate from "@/components/TermsConsentGate";
import ScrollButtons from "@/components/ScrollButtons";
import type { Metadata } from "next";

const ICON_VERSION = "2026-03-05";

export const metadata: Metadata = {
  metadataBase: new URL("https://minnade-tsukuru.vercel.app"),

  title: {
    default: "みんつく",
    template: "%s | みんつく",
  },

  description: "つくりたい人、集合。ひとりのアイデアを、みんなの作品へ。",

  icons: {
    icon: [
      {
        url: `/favicon.ico?v=${ICON_VERSION}`,
      },
      {
        url: `/icon.png?v=${ICON_VERSION}`,
        type: "image/png",
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
    title: "みんつく",
    description:
      "最大50人で共同制作。制限時間付きの創作ルームで、みんなのアイデアを形に。",
    url: "https://minnade-tsukuru.vercel.app",
    siteName: "みんつく",

    images: [
      {
        url: "/ogp.png",
        width: 1200,
        height: 630,
        alt: "みんつく",
      },
    ],

    locale: "ja_JP",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "みんつく",
    description: "最大50人で共同制作できる創作プラットフォーム。",
    images: ["/ogp.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <Header />
        {process.env.STAGING_TEST === "true" && (
          <aside className="stagingNotice">
            検収用stagingです。テスト用の投稿だけを使用してください。
          </aside>
        )}
        <TermsConsentGate />
        <main id="main-content" className="main">
          {children}
        </main>
        <footer className="siteFooter">
          <LegalLinks />
          <p>
            <SupportContact />
          </p>
        </footer>
        <ScrollButtons />
      </body>
    </html>
  );
}
