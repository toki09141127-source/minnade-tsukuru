import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // ✅ token から user を確定（なりすまし防止）
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }
    const user = userRes.user

    const body = await req.json().catch(() => null)
    const roomId = body?.roomId as string | undefined
    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }

    // 1) room 取得（status=openのみ参加可）
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .single()

    if (roomErr || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    if (room.status !== 'open') {
      return NextResponse.json(
        { error: 'Room is not open (status must be open)' },
        { status: 400 }
      )
    }

    // 2) すでに参加してるか
    const { data: exists, error: existsErr } = await supabaseAdmin
      .from('room_members')
      .select('id, is_core')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existsErr) {
      return NextResponse.json({ error: existsErr.message }, { status: 400 })
    }
    if (exists?.id) {
      return NextResponse.json({ already: true, is_core: !!exists.is_core })
    }

    // 3) 現在人数（最大50）
    const { count: totalCount, error: cntErr } = await supabaseAdmin
      .from('room_members')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)

    if (cntErr) {
      return NextResponse.json({ error: cntErr.message }, { status: 400 })
    }
    if ((totalCount ?? 0) >= 50) {
      return NextResponse.json({ error: 'Room is full (max 50)' }, { status: 400 })
    }

    // 4) CORE人数（先着5がCORE）
    const { count: coreCount, error: coreErr } = await supabaseAdmin
      .from('room_members')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('is_core', true)

    if (coreErr) {
      return NextResponse.json({ error: coreErr.message }, { status: 400 })
    }

    const isCore = (coreCount ?? 0) < 5

    // 5) username を profiles から取る（無ければメールの@前）
    let username: string | null = null
    const { data: prof, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (!profErr) {
      username = (prof?.username as string | null) ?? null
    }

    if (!username) {
      const email = user.email ?? ''
      username = email ? email.split('@')[0] : '名無し'
    }

    // 6) 参加登録（service_roleでinsert）
    const { error: insErr } = await supabaseAdmin.from('room_members').insert({
      room_id: roomId,
      user_id: user.id,
      username,
      is_core: isCore,
    })

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, is_core: isCore })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unexpected error' },
      { status: 500 }
    )
  }
}
