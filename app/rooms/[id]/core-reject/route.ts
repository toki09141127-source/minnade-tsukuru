// app/rooms/[id]/core-reject/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { createUserClient, createAdminClient } from '@/lib/supabase/server'

type Params = { id: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id: roomId } = await params
  const supabase = await createUserClient()
  const admin = createAdminClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({} as any))
  const requestId = body?.requestId as string | undefined
  if (!requestId) return NextResponse.json({ error: 'requestId required' }, { status: 400 })

  // オーナー確認
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('created_by')
    .eq('id', roomId)
    .single()

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 400 })
  if (room?.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 申請確認
  const { data: reqRow, error: reqErr } = await admin
    .from('room_join_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 400 })
  if (reqRow.room_id !== roomId) {
    return NextResponse.json({ error: 'Request does not belong to this room' }, { status: 400 })
  }
  if (reqRow.status !== 'pending') {
    return NextResponse.json({ success: true, alreadyProcessed: true })
  }

  const { error: updErr } = await admin
    .from('room_join_requests')
    .update({
      status: 'rejected',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
