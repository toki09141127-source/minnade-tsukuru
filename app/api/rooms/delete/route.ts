import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRes } = await supabaseAdmin.auth.getUser(token)
    const user = userRes.user
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await req.json()
    if (!roomId) {
      return NextResponse.json({ ok: false, error: 'roomId required' }, { status: 400 })
    }

    // 作成者チェック
    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('user_id')
      .eq('id', roomId)
      .maybeSingle()

    if (!room || room.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: '削除権限なし' }, { status: 403 })
    }

    // 関連データ削除
    await supabaseAdmin.from('posts').delete().eq('room_id', roomId)
    await supabaseAdmin.from('room_members').delete().eq('room_id', roomId)
    await supabaseAdmin.from('room_likes').delete().eq('room_id', roomId)

    // ルーム削除
    const { error } = await supabaseAdmin.from('rooms').delete().eq('id', roomId)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
