import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

function userClientFromToken(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ ok: false, error: 'no token' }, { status: 401 })

    const supaUser = userClientFromToken(token)
    const { data: u } = await supaUser.auth.getUser()
    const uid = u.user?.id
    if (!uid) return NextResponse.json({ ok: false, error: 'no user' }, { status: 401 })

    const { roomId } = await req.json()
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId required' }, { status: 400 })

    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .maybeSingle()

    if (!room) return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })
    if (room.status !== 'open') {
      return NextResponse.json({ ok: false, error: 'このルームは現在参加できません（openのみ）' }, { status: 400 })
    }

    // 既に参加済み？
    const { data: already } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', uid)
      .maybeSingle()

    if (already) return NextResponse.json({ ok: true, message: 'すでに参加しています。' })

    // 人数制限
    const { count: total } = await supabaseAdmin
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)

    if ((total ?? 0) >= 50) {
      return NextResponse.json({ ok: false, error: '満員のため参加できません（最大50人）' }, { status: 400 })
    }

    // コア枠（先着5名）
    const { count: coreCount } = await supabaseAdmin
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('is_core', true)

    const isCore = (coreCount ?? 0) < 5

    // username を profiles からコピー
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', uid)
      .maybeSingle()

    const { error } = await supabaseAdmin.from('room_members').insert({
      room_id: roomId,
      user_id: uid,
      username: prof?.username ?? null,
      is_core: isCore,
    })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({
      ok: true,
      message: isCore ? '参加しました（CORE）' : '参加しました（SUPPORTER）',
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
