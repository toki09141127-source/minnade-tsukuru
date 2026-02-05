// app/api/posts/create/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // 1) auth
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = userRes.user

    // 2) body
    const body = await req.json()
    const roomId = String(body.roomId ?? '')
    const content = String(body.content ?? '').trim()

    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })
    if (!content) return NextResponse.json({ ok: false, error: 'content is required' }, { status: 400 })
    if (content.length > 500) {
      return NextResponse.json({ ok: false, error: 'content is too long (max 500)' }, { status: 400 })
    }

    // 3) 参加者のみ投稿OK
    const { data: mem } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!mem) {
      return NextResponse.json({ ok: false, error: '参加者のみ投稿できます' }, { status: 403 })
    }

    // 4) username を確実に作る（絶対 null にしない）
    const metaName = (user.user_metadata?.username as string | undefined) ?? ''
    let username = metaName.trim()

    if (!username) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()

      username = String(prof?.username ?? '').trim()
    }

    if (!username) username = '名無し' // ✅ 最終保険

    // 5) insert
    const { data: post, error: insErr } = await supabaseAdmin
      .from('posts')
      .insert({
        room_id: roomId,
        user_id: user.id,
        username,
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
