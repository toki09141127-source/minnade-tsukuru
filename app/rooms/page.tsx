// app/rooms/page.tsx
import RoomsListClient from './RoomsListClient'
import Link from 'next/link'

export default function RoomsPage() {
  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px' }}>
      {/* ← 上の作成ボタンだけ残す */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>制作ルーム一覧</h1>
        <Link
          href="/rooms/create"
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            background: '#111',
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          ＋ルームを作成
        </Link>
      </div>

      {/* 一覧 */}
      <RoomsListClient />
    </div>
  )
}
