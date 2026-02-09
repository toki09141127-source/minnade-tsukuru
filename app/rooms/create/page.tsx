import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import RoomCreateClient from './RoomCreateClient'

export default async function RoomCreatePage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data?.user) redirect('/login')

  return (
    <div style={{ maxWidth: 920, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>ルーム作成</h1>
        <Link href="/rooms" style={{ textDecoration: 'none' }}>← ルーム一覧へ</Link>
      </div>

      <RoomCreateClient />
    </div>
  )
}
