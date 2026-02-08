// app/works/page.tsx
import { createClient } from '@supabase/supabase-js'
import WorksListClient from './WorksListClient'

export const dynamic = 'force-dynamic'

export default async function WorksPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // publishedだけ表示
  const { data, error } = await admin
    .from('rooms_with_counts')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) return <div className="card">読み込みエラー: {error.message}</div>

  return (
    <div className="container">
      <h1 className="h1">完成作品</h1>
      <WorksListClient initialRooms={data ?? []} />
    </div>
  )
}
