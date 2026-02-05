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

    const { roomId, content } = await req.json()
    const text = String(content ?? '').trim()
    if (!roomId || !text) return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 })

    // room open?
    const { data: room } = await supabaseAdmin.from('rooms').select('status').eq('id', roomId).maybeSingle()
    if (!room) return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })
    if (room.status !== 'open') return NextResponse.json({ ok: false, error: 'closed' }, { status: 400 })

    // joined?
    const { data: mem } = await supabaseAdmin
      .from('room_members')
      .select('username')
      .eq('room_id', roomId)
      .eq('user_id', uid)
      .maybeSingle()

    if (!mem) return NextResponse.json({ ok: false, error: '参加者のみ投稿できます' }, { status: 403 })

    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .insert({
        room_id: roomId,
        user_id: uid,
        username: mem.username ?? null,
        content: text,
      })
      .select('id, user_id, username, content, created_at')
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, post })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
