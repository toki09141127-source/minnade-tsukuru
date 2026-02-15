import { NextResponse, NextRequest } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = createUserClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // オーナーが作ったルームに紐づく pending core 申請数
  // RLSで owner_select を貼っているので、selectできる範囲=自分のルームの申請だけ
  const { count, error } = await supabase
    .from('room_join_requests')
    .select('id', { count: 'exact', head: true })
    .eq('requested_role', 'core')
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ count: count ?? 0 })
}
