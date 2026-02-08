// app/api/rooms/join/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../../../../lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = body?.roomId as string | undefined

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }

    // Cookieベースのログインユーザー取得
    const supabase = await createSupabaseServerClient()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    const user = userRes?.user

    if (userErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Service Role で insert（RLSを確実に回避）
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // usernameを profiles から取る（NULL禁止対策）
    const { data: prof, error: profErr } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 })
    }

    const username = prof?.username ?? '名無し'

    // すでに参加済みなら何もしない（多重参加ボタン連打対策）
    const { data: existing, error: existErr } = await admin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 500 })
    }

    if (existing?.id) {
      return NextResponse.json({ ok: true, already: true })
    }

    const { error: insErr } = await admin.from('room_members').insert({
      room_id: roomId,
      user_id: user.id,
      username,
    })

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 })
  }
}
