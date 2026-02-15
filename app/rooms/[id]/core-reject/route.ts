import { NextResponse, NextRequest } from 'next/server'
import { createUserClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = createUserClient()
  const admin = createAdminClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requestId } = await req.json()
  if (!requestId) return NextResponse.json({ error: 'requestId is required' }, { status: 400 })

  // オーナー確認
  const { data: room } = await supabase.from('rooms').select('created_by').eq('id', roomId).single()
  if (room?.created_by !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // pendingのみ reject 可能（冪等：すでにrejectedなら成功扱いでもOK）
  const { data: jr } = await admin
    .from('room_join_requests')
    .select('status')
    .eq('id', requestId)
    .eq('room_id', roomId)
    .single()

  if (jr?.status === 'rejected') return NextResponse.json({ success: true })

  const { error } = await admin
    .from('room_join_requests')
    .update({
      status: 'rejected',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
