import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function supabaseFromAuthHeader(authHeader: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient(url, anon, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') // "Bearer xxx"
    const supabaseUser = supabaseFromAuthHeader(auth)

    const { data: userRes, error: userErr } = await supabaseUser.auth.getUser()
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const uid = userRes.user.id
    const body = await req.json()
    const roomId = String(body.roomId ?? '')

    if (!roomId) {
      return NextResponse.json({ ok: false, error: 'roomId required' }, { status: 400 })
    }

    // 1) ルーム確認
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .single()

    if (roomErr || !room) {
      return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })
    }
    if (room.status !== 'open') {
      return NextResponse.json({ ok: false, error: 'このルームは現在参加できません' }, { status: 400 })
    }

    // 2) すでに参加してたらOK扱い
    const { data: existing } = await supabaseAdmin
      .from('room_members')
      .select('id, is_core')
      .eq('room_id', roomId)
      .eq('user_id', uid)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, joined: true, already: true })
    }

    // 3) 参加者上限チェック
    const { count } = await supabaseAdmin
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)

    if ((count ?? 0) >= 50) {
      return NextResponse.json({ ok: false, error: '満員です（最大50人）' }, { status: 400 })
    }

    // 4) insert（supporterとして参加。coreは招待コードなど別APIでやる）
    const { error: insErr } = await supabaseAdmin
      .from('room_members')
      .insert({
        room_id: roomId,
        user_id: uid,
        username: userRes.user.user_metadata?.username ?? null,
        is_core: false,
      })

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, joined: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
