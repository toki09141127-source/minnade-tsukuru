import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
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

    const body = await req.json()
    const username = String(body.username ?? '').trim()

    if (!username) return NextResponse.json({ ok: false, error: 'username is required' }, { status: 400 })
    if (username.length > 24) return NextResponse.json({ ok: false, error: 'username too long (max 24)' }, { status: 400 })

    // 1) profiles 更新（upsert）
    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: user.id, username }, { onConflict: 'id' })

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })

    // 2) 過去投稿の username を一括更新
    const { error: postErr } = await supabaseAdmin
      .from('posts')
      .update({ username })
      .eq('user_id', user.id)

    if (postErr) return NextResponse.json({ ok: false, error: postErr.message }, { status: 400 })

    // 3) 参加者表示（room_members.username）も一括更新
    const { error: memErr } = await supabaseAdmin
      .from('room_members')
      .update({ username })
      .eq('user_id', user.id)

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
