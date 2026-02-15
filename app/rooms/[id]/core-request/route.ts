// app/rooms/[id]/core-request/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'

type Params = { id: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id: roomId } = await params
  const supabase = await createUserClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({} as any))
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
