// app/api/notifications/pending-core-count/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createUserClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // オーナーのルーム一覧
  const { data: rooms, error: roomsErr } = await supabase
    .from('rooms')
    .select('id')
    .eq('created_by', user.id)

  if (roomsErr) return NextResponse.json({ error: roomsErr.message }, { status: 400 })

  const roomIds = (rooms ?? []).map((r) => r.id)
  if (roomIds.length === 0) {
    return NextResponse.json({ count: 0 })
  }

  // pending core 申請数
  const { count, error: countErr } = await supabase
    .from('room_join_requests')
    .select('id', { count: 'exact', head: true })
    .in('room_id', roomIds)
    .eq('requested_role', 'core')
    .eq('status', 'pending')

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 400 })

  return NextResponse.json({ count: count ?? 0 })
}
