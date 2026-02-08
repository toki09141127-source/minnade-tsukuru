// app/api/rooms/join/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = body?.roomId as string | undefined

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }

    // ✅ Authorization: Bearer <token> からユーザー検証
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = userData.user

    // ✅ Service Role（RLS回避して insert）
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // username を profiles から取得（null対策）
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 })
    }

    const username = profile?.username ?? '名無し'

    // 既に参加済みならOK（連打対策）
    const { data: existing, error: existErr } = await admin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existErr && existErr.code !== 'PGRST116') {
      return NextResponse.json({ error: existErr.message }, { status: 500 })
    }

    if (!existing) {
      const { error: insErr } = await admin.from('room_members').insert({
        room_id: roomId,
        user_id: user.id,
        username,
        role: 'supporter',
      })

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
