import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  const supabase = createUserClient()
  const { roomId } = await context.params

  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
