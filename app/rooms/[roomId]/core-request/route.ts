// app/api/rooms/[roomId]/core-request/route.ts

import { NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
    const supabase = createUserClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = params

  const { error } = await supabase
    .from('room_join_requests')
    .insert({
      room_id: roomId,
      user_id: userData.user.id,
      requested_role: 'core',
      status: 'pending'
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
