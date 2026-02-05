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
    if (userErr || !userRes.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const uid = userRes.user.id

    const body = await req.json()
    const roomId = String(body.roomId ?? '')
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })

    // ✅ rooms.user_id は見ない。room_members の core だけ削除できる
    const { data: mem } = await supabaseAdmin
      .from('room_members')
      .select('id, is_core')
      .eq('room_id', roomId)
      .eq('user_id', uid)
      .maybeSingle()

    if (!mem) return NextResponse.json({ ok: false, error: '参加者のみ削除できます' }, { status: 403 })
    if (!mem.is_core) return NextResponse.json({ ok: false, error: 'コア参加者のみ削除できます' }, { status: 403 })

    // 依存テーブルを消してから rooms を消す（FKがある場合の安全策）
    await supabaseAdmin.from('posts').delete().eq('room_id', roomId)
    await supabaseAdmin.from('room_likes').delete().eq('room_id', roomId)
    await supabaseAdmin.from('room_members').delete().eq('room_id', roomId)

    const { error: delErr } = await supabaseAdmin.from('rooms').delete().eq('id', roomId)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
