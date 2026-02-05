import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'No token' }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 })
    }
    const user = userRes.user

    const body = await req.json()
    const roomId = body?.roomId as string | undefined
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId required' }, { status: 400 })

    // すでに参加済み？
    const { data: existing } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing?.id) {
      return NextResponse.json({ ok: true, already: true })
    }

    // 参加者数を数える（最大50）
    const { count: memberCount } = await supabaseAdmin
      .from('room_members')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)

    if ((memberCount ?? 0) >= 50) {
      return NextResponse.json({ ok: false, error: '満員です（最大50人）' }, { status: 400 })
    }

    // コア枠（先着5）
    const { count: coreCount } = await supabaseAdmin
      .from('room_members')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('is_core', true)

    const isCore = (coreCount ?? 0) < 5

    // 表示名（profiles.username を使う）
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    const username =
      prof?.username ??
      user.user_metadata?.username ??
      user.email?.split('@')[0] ??
      '名無し'

    const { error: insErr } = await supabaseAdmin.from('room_members').insert({
      room_id: roomId,
      user_id: user.id,
      username,
      is_core: isCore,
    })

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, isCore })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
