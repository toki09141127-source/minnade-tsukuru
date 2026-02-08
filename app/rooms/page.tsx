// app/rooms/page.tsx
import { createClient } from '@supabase/supabase-js'
import RoomsListClient from './RoomsListClient'

export const dynamic = 'force-dynamic'

export default async function RoomsPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data, error } = await admin
    .from('rooms_with_counts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="card">読み込みエラー: {error.message}</div>
  }

  return (
    <div className="container">
      <h1 className="h1">制作ルーム一覧</h1>
      <RoomsListClient initialRooms={data ?? []} />
    </div>
  )
}
