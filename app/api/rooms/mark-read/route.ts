// app/api/rooms/mark-read/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // ---- Auth（Bearer token 必須）
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = userRes.user

    // ---- Body
    const body = await req.json().catch(() => ({}))
    const roomId = (body?.roomId as string | undefined)?.trim()
    if (!roomId) {
      return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // ✅ 終了済みでも更新できるように left_at 条件を外す
    // ✅ さらに "更新できたか" を可視化するため select を付ける
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('room_members')
      .update({ last_read_at: now })
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .select('room_id, user_id, last_read_at, left_at')
      .maybeSingle()

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })
    }

    // ✅ 1行も更新されてない（＝該当 membership が無い等）
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'room_members row not found for this user/room' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true, updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 })
  }
}