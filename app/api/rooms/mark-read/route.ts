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

    // ---- 既読化（room_members の last_read_at を now() に更新）
    // ※あなたの room_members に last_read_at が無い場合は、この方式は使えないので教えて
    const { error: updErr } = await supabaseAdmin
      .from('room_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('left_at', null)

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 })
  }
}