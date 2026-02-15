import { NextResponse, NextRequest } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = createUserClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const message = typeof body?.message === 'string' ? body.message : null

  const { error } = await supabase.from('room_join_requests').insert({
    room_id: roomId,
    user_id: user.id,
    requested_role: 'core',
    status: 'pending',
    message,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
