// app/rooms/page.tsx
import Link from 'next/link'
import RoomsListClient from './RoomsListClient'

export const dynamic = 'force-dynamic'

export default function RoomsPage() {
  return (
    <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>制作ルーム一覧</h1>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/profile" style={{ textDecoration: 'none' }}>
            ユーザー名を設定
          </Link>
          <Link
            href="/rooms/create"
            style={{
              textDecoration: 'none',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              fontWeight: 900,
            }}
          >
            ＋ ルームを作成
          </Link>
        </div>
      </div>

      {/* 一覧本体（client） */}
      <RoomsListClient />
    </div>
  )
}
