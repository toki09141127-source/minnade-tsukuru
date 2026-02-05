import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const user = userRes.user

    const body = await req.json()
    const username = String(body.username ?? '').trim()

    if (username.length < 2 || username.length > 20) {
      return NextResponse.json({ ok: false, error: 'username must be 2-20 chars' }, { status: 400 })
    }

    // profiles 更新（存在しなければ insert、あれば update）
    const { error: upsertErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: user.id, username }, { onConflict: 'id' })

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 400 })
    }

    // 過去投稿の username を一括更新（任意だが体験が良くなる）
    await supabaseAdmin.from('posts').update({ username }).eq('user_id', user.id)

    // 参加者表示も一括更新
    await supabaseAdmin.from('room_members').update({ username }).eq('user_id', user.id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
