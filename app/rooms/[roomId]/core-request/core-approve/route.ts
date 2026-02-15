// app/api/rooms/[roomId]/core-approve/route.ts

import { NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const supabase = createUserClient()
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { requestId } = await req.json()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = params

  // 🔥 created_by に修正
  const { data: room } = await supabase
    .from('rooms')
    .select('created_by')
    .eq('id', roomId)
    .single()

  if (room?.created_by !== userData.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: requestData } = await admin
    .from('room_join_requests')
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      decided_by: userData.user.id
    })
    .eq('id', requestId)
    .select()
    .single()

  await admin.from('room_members').insert({
    room_id: roomId,
    user_id: requestData.user_id,
    role: 'core'
  })

  return NextResponse.json({ success: true })
}
