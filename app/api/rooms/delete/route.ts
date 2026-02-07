// app/api/rooms/delete/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // --- auth ---
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = userRes.user

    // --- body ---
    const body = await req.json()
    const roomId = String(body.roomId ?? '').trim()
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })

    // --- room fetch (host check) ---
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id, host_id, deleted_at')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr || !room) return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })
    if (room.deleted_at) return NextResponse.json({ ok: false, error: 'already deleted' }, { status: 400 })

    if (room.host_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'host only' }, { status: 403 })
    }

    // --- logical delete ---
    const { error: delErr } = await supabaseAdmin.from('rooms').update({ deleted_at: new Date().toISOString() }).eq('id', roomId)

    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
