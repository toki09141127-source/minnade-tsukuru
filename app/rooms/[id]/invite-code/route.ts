import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id

    // --- Auth ---
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    const userId = userData.user.id
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, created_by, enable_core_invite, core_invite_code')
      .eq('id', roomId)
      .single()

    if (roomErr || !room) {
      return NextResponse.json({ ok: false, error: 'Room not found' }, { status: 404 })
    }

    // ✅ 制作者のみ
    if (room.created_by !== userId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    if (!room.enable_core_invite) {
      return NextResponse.json({ ok: true, enable: false, code: null })
    }

    return NextResponse.json({
      ok: true,
      enable: true,
      code: room.core_invite_code ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
