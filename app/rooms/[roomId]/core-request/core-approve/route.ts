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

  // ① ルームのオーナー確認
  const { data: room } = await supabase
    .from('rooms')
    .select('created_by')
    .eq('id', roomId)
    .single()

  if (!room || room.created_by !== userData.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ② service role で安全に処理
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ③ 申請を approved に更新
  const { data: requestData, error: updateError } = await admin
    .from('room_join_requests')
    .update({
      status: 'approved',
      decided_by: userData.user.id,
      decided_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .eq('room_id', roomId)
    .eq('status', 'pending')
    .select()
    .single()

  if (updateError || !requestData) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Request not found' },
      { status: 400 }
    )
  }

  // ④ coreメンバーとして追加
  const { error: insertError } = await admin
    .from('room_members')
    .insert({
      room_id: roomId,
      user_id: requestData.user_id,
      role: 'core'
    })

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true })
}
