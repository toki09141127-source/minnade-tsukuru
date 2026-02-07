// app/api/posts/create/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // --- auth ---
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = userRes.user

    // --- body ---
    const body = await req.json()
    const roomId = String(body.roomId ?? '').trim()
    const content = String(body.content ?? '').trim()

    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })
    if (!content) return NextResponse.json({ ok: false, error: 'content is required' }, { status: 400 })
    if (content.length > 2000) {
      return NextResponse.json({ ok: false, error: 'content is too long (max 2000)' }, { status: 400 })
    }

    // ✅ 1) ルームが open か確認
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr || !room) {
      return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })
    }
    if (room.status !== 'open') {
      return NextResponse.json({ ok: false, error: 'room is not open' }, { status: 400 })
    }

    // ✅ 2) 参加者か確認（あなたのDBは room_members を使ってる前提）
    const { data: mem, error: memErr } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memErr) {
      return NextResponse.json({ ok: false, error: memErr.message }, { status: 400 })
    }
    if (!mem) {
      return NextResponse.json({ ok: false, error: 'not a member' }, { status: 403 })
    }

    // username（profiles優先。なければ「名無し」）
    let username: string | null = null
    const { data: prof, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 })
    }
    username = (prof?.username ?? '').trim() || null
    const safeUsername = username ?? '名無し'

    // ✅ 3) 投稿を保存（BoardClient と同じ room_posts に統一）
    const { data: post, error: insErr } = await supabaseAdmin
      .from('room_posts')
      .insert({
        room_id: roomId,
        user_id: user.id,
        username: safeUsername,
        content,
      })
      .select('id, room_id, user_id, username, content, created_at')
      .single()

    if (insErr || !post) {
      return NextResponse.json({ ok: false, error: insErr?.message ?? 'insert failed' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, post })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
