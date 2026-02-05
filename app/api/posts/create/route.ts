import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRes } = await supabaseAdmin.auth.getUser(token)
    const user = userRes.user
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const roomId = String(body.roomId ?? '')
    const content = String(body.content ?? '').trim()

    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })
    if (!content) return NextResponse.json({ ok: false, error: 'content is required' }, { status: 400 })

    // 参加者チェック
    const { data: mem } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!mem) {
      return NextResponse.json({ ok: false, error: '参加者のみ投稿できます' }, { status: 403 })
    }

    // ★ profiles から username を必ず取得
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const safeUsername = prof?.username || '名無し'

    const { data: post, error: insErr } = await supabaseAdmin
      .from('posts')
      .insert({
        room_id: roomId,
        user_id: user.id,
        username: safeUsername,
        content,
      })
      .select('id, user_id, username, content, created_at')
      .single()

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, post })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
