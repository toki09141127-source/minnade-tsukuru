import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await context.params
  const supabase = createUserClient()

  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { requestId } = await req.json()

  // ① オーナー確認
  const { data: room } = await supabase
    .from('rooms')
    .select('created_by')
    .eq('id', roomId)
    .single()

  if (!room || room.created_by !== userData.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ② service role で更新
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin
    .from('room_join_requests')
    .update({
      status: 'rejected',
      decided_by: userData.user.id,
      decided_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .eq('room_id', roomId)
    .eq('status', 'pending')

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true })
}
