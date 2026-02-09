// app/rooms/create/page.tsx
import Link from 'next/link'
import RoomCreateClient from './RoomCreateClient'

export default function RoomCreatePage() {
  return (
    <div style={{ maxWidth: 820, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>ルーム作成</h1>
        <Link href="/rooms" style={{ textDecoration: 'none' }}>
          ← ルーム一覧へ
        </Link>
      </div>

      {/* ✅ サーバ側redirectはしない。ログイン判定はクライアント側で行う */}
      <RoomCreateClient />
    </div>
  )
}
