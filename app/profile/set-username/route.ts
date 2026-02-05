import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = userRes.user
    const uid = user.id

    const body = await req.json()
    const username = String(body.username ?? '').trim()

    if (!username) return NextResponse.json({ ok: false, error: 'username is required' }, { status: 400 })
    if (username.length > 20)
      return NextResponse.json({ ok: false, error: 'username is too long (max 20)' }, { status: 400 })

    // 1) profiles を upsert（存在しなくても作る）
    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: uid, username }, { onConflict: 'id' })

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })

    // 2) auth.user_metadata も更新（表示が metadata 依存でも反映される）
    const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(uid, {
      user_metadata: { ...(user.user_metadata ?? {}), username },
    })
    if (metaErr) return NextResponse.json({ ok: false, error: metaErr.message }, { status: 400 })

    // 3) 過去投稿・参加者名も一括更新（username を保持してるテーブルがあるなら）
    await supabaseAdmin.from('posts').update({ username }).eq('user_id', uid)
    await supabaseAdmin.from('room_members').update({ username }).eq('user_id', uid)

    return NextResponse.json({ ok: true, username })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
