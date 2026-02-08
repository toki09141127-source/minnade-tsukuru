// app/api/posts/create/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = body?.roomId as string | undefined
    const content = (body?.content as string | undefined)?.trim()

    if (!roomId || !content) {
      return NextResponse.json({ error: 'roomId / content is required' }, { status: 400 })
    }

    const supabaseAuth = createRouteHandlerClient({ cookies })
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // ルーム状態チェック
    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 })
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    if (room.status !== 'open') {
      return NextResponse.json({ error: 'Room is not open' }, { status: 400 })
    }

    // 参加者チェック
    const { data: member, error: memErr } = await admin
      .from('room_members')
      .select('username')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })
    if (!member) return NextResponse.json({ error: 'Not joined' }, { status: 403 })

    const { error: insErr } = await admin.from('posts').insert({
      room_id: roomId,
      user_id: user.id,
      username: member.username,
      content,
    })

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
