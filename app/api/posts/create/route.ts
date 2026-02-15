// app/api/posts/create/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = (body?.roomId as string | undefined)?.trim()
    const content = (body?.content as string | undefined)?.trim()

    const post_type_raw = (body?.post_type as string | undefined)?.trim()
    const post_type = post_type_raw === 'final' ? 'final' : 'log' // 表記揺れ防止

    // attachment_url は「Storageのpath」を入れる（署名URLは入れない）
    const attachment_url = (body?.attachment_url as string | null | undefined) ?? null
    const attachment_type = (body?.attachment_type as string | null | undefined) ?? null

    if (!roomId || !content) {
      return NextResponse.json({ error: 'roomId / content is required' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: 'content is too long (max 2000)' }, { status: 400 })
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

    // ルーム確認
    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 })
    if (!room) return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 })
    if (room.status !== 'open') {
      return NextResponse.json(
        { error: `このルームは ${room.status} のため投稿できません` },
        { status: 403 }
      )
    }

    // ✅ 参加者チェック（最重要）
    const { data: mem, error: memErr } = await admin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })
    if (!mem) {
      return NextResponse.json(
        { error: 'ルームに参加してから投稿してください' },
        { status: 403 }
      )
    }

    // username
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })
    const username = (profile?.username ?? '').trim() || '名無し'

    const { error: insErr } = await admin.from('posts').insert({
      room_id: roomId,
      user_id: user.id,
      username,
      content,
      post_type,
      attachment_url,
      attachment_type,
      is_hidden: false,
      deleted_at: null,
    })

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
