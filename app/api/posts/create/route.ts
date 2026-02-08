// app/api/posts/create/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = body?.roomId as string | undefined
    const content = (body?.content as string | undefined)?.trim()

    if (!roomId || !content) {
      return NextResponse.json({ error: 'roomId / content is required' }, { status: 400 })
    }

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

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // ルームがopenか確認
    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 })
    if (!room) return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 })
    if (room.status !== 'open') {
      return NextResponse.json({ error: `このルームは ${room.status} のため投稿できません` }, { status: 400 })
    }

    // username（null禁止対策）
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })
    const username = profile?.username ?? '名無し'

    const { error: insErr } = await admin.from('posts').insert({
      room_id: roomId,
      user_id: user.id,
      username,
      content,
      is_hidden: false,
      deleted_at: null,
    })

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
