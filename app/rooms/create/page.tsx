// app/rooms/create/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import RoomCreateClient from './RoomCreateClient'

export default async function RoomCreatePage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data?.user) redirect('/login')

  return (
    <div style={{ maxWidth: 820, margin: '24px auto', padding: '0 16px' }}>
      {/* ← ここだけ残す */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>ルーム作成</h1>
        <Link href="/rooms">← ルーム一覧へ</Link>
      </div>

      {/* フォーム本体 */}
      <RoomCreateClient />
    </div>
  )
}
