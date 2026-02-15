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
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('created_by')
    .eq('id', roomId)
    .single()

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 400 })
  if (room?.created_by !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 対象申請を取得（adminで確実に取得）
  const { data: jr, error: jrErr } = await admin
    .from('room_join_requests')
    .select('*')
    .eq('id', requestId)
    .eq('room_id', roomId)
    .eq('requested_role', 'core')
    .single()

  if (jrErr) return NextResponse.json({ error: jrErr.message }, { status: 400 })

  // すでに approved なら冪等に成功扱い
  if (jr.status !== 'pending' && jr.status !== 'approved') {
    return NextResponse.json({ error: `Cannot approve from status=${jr.status}` }, { status: 400 })
  }

  // 申請を approved
  if (jr.status === 'pending') {
    const { error: upErr } = await admin
      .from('room_join_requests')
      .update({
        status: 'approved',
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })
  }

  // room_members を core に昇格（既存supporterなら更新、なければ作成）
  // room_membersに (room_id,user_id) UNIQUE がある想定。ないなら後で追加推奨。
  const { error: memErr } = await admin
    .from('room_members')
    .upsert(
      { room_id: roomId, user_id: jr.user_id, role: 'core' },
      { onConflict: 'room_id,user_id' }
    )

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
