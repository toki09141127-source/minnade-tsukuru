// app/api/posts/create/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../../../../lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = body?.roomId as string | undefined
    const content = (body?.content as string | undefined)?.trim()

    if (!roomId || !content) {
      return NextResponse.json({ error: 'roomId / content is required' }, { status: 400 })
    }

    // Cookieベースのログインユーザー
    const supabase = await createSupabaseServerClient()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    const user = userRes?.user
    if (userErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Service Role
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // username（NULL禁止なら必須）
    const { data: prof, error: profErr } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })

    const username = prof?.username ?? '名無し'

    // 参加してないユーザーは投稿禁止（room_members 必須）
    const { data: member, error: memErr } = await admin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })
    if (!member?.id) {
      return NextResponse.json({ error: 'Not joined this room' }, { status: 403 })
    }

    const { error: insErr } = await admin.from('posts').insert({
      room_id: roomId,
      user_id: user.id,
      username,
      content,
    })

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 })
  }
}
