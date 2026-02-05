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

    const body = await req.json()
    const title = String(body.title ?? '').trim()
    const workType = String(body.workType ?? 'novel')
    const timeLimitHours = Number(body.timeLimitHours ?? 50)

    if (!title) return NextResponse.json({ ok: false, error: 'title required' }, { status: 400 })

    // host_ids を必ず入れる（NOT NULL対策の決定打）
    const { data: room, error } = await supabaseAdmin
      .from('rooms')
      .insert({
        title,
        work_type: workType,
        status: 'open',
        time_limit_hours: timeLimitHours,
        host_ids: [uid],  // ★ここ重要
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    // 作成者はコアで参加させる
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', uid)
      .maybeSingle()

    await supabaseAdmin.from('room_members').insert({
      room_id: room.id,
      user_id: uid,
      username: prof?.username ?? null,
      is_core: true,
    })

    return NextResponse.json({ ok: true, roomId: room.id })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
