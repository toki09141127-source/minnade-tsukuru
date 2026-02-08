// app/api/rooms/join/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = body?.roomId as string | undefined

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }

    // ✅ ログインユーザー取得（Cookieベース）
    const supabaseAuth = createRouteHandlerClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabaseAuth.auth.getUser()

    if (userErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // ✅ Service role client（RLSをバイパスして insert する）
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // ✅ username を profiles から取得（NULL禁止対策）
    const { data: prof, error: profErr } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 })
    }

    const username = prof?.username?.trim()
    if (!username) {
      return NextResponse.json(
        { error: 'username が未設定です。/profile でユーザー名を設定してください。' },
        { status: 400 }
      )
    }

    // ✅ 既に参加済みなら何もしない
    const { data: existing, error: existErr } = await admin
      .from('room_members')
      .select('room_id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 500 })
    }
    if (existing) {
      return NextResponse.json({ ok: true, alreadyJoined: true })
    }

    // ✅ 参加（supporterで参加）
    const { error: insErr } = await admin.from('room_members').insert({
      room_id: roomId,
      user_id: user.id,
      username,
      role: 'supporter',
    })

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
