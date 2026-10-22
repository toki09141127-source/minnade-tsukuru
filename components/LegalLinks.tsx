import Link from 'next/link'
export default function LegalLinks() {
  return <nav aria-label="利用案内" style={{display:'flex',gap:12,flexWrap:'wrap',lineHeight:1.8}}>
    <Link href="/terms">利用規約</Link><Link href="/privacy">プライバシーポリシー</Link>
    <Link href="/guidelines">コミュニティガイドライン</Link>
  </nav>
}
