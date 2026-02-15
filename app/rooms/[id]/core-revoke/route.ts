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

  // 対象申請取得
  const { data: jr, error: jrErr } = await admin
    .from('room_join_requests')
    .select('*')
    .eq('id', requestId)
    .eq('room_id', roomId)
    .eq('requested_role', 'core')
    .single()

  if (jrErr) return NextResponse.json({ error: jrErr.message }, { status: 400 })

  // approvedのみ revoke（冪等：すでにrevokedなら成功）
  if (jr.status === 'revoked') return NextResponse.json({ success: true })
  if (jr.status !== 'approved') {
    return NextResponse.json({ error: `Cannot revoke from status=${jr.status}` }, { status: 400 })
  }

  // 申請を revoked に
  const { error: upErr } = await admin
    .from('room_join_requests')
    .update({
      status: 'revoked',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  // membershipをsupporterへdowngrade（削除より安全）
  const { error: memErr } = await admin
    .from('room_members')
    .update({ role: 'supporter' })
    .eq('room_id', roomId)
    .eq('user_id', jr.user_id)
    .eq('role', 'core')

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
