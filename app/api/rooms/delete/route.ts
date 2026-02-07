// app/api/rooms/delete/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const uid = userRes.user.id

    const body = await req.json()
    const roomId = String(body.roomId ?? '').trim()
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })

    // ルーム取得（ホスト判定）
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id, host_ids')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr || !room) return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })

    const hostIds = (room as any).host_ids as string[] | null
    const isHost = Array.isArray(hostIds) && hostIds.includes(uid)
    if (!isHost) return NextResponse.json({ ok: false, error: 'host only' }, { status: 403 })

    // 関連を先に消す（FKが無い想定でも安全）
    await supabaseAdmin.from('posts').delete().eq('room_id', roomId)
    await supabaseAdmin.from('room_members').delete().eq('room_id', roomId)
    await supabaseAdmin.from('room_likes').delete().eq('room_id', roomId)

    // ルーム本体
    const { error: delErr } = await supabaseAdmin.from('rooms').delete().eq('id', roomId)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
