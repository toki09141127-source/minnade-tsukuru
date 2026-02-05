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

    const body = await req.json()
    const username = String(body.username ?? '').trim()

    if (!username) {
      return NextResponse.json({ ok: false, error: 'ユーザー名を入力してください' }, { status: 400 })
    }
    if (username.length > 20) {
      return NextResponse.json({ ok: false, error: 'ユーザー名は20文字以内にしてください' }, { status: 400 })
    }

    // 1) profiles を upsert（無ければ作る）
    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: user.id, username }, { onConflict: 'id' })

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })

    // 2) user_metadata も更新（任意だが便利）
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...(user.user_metadata ?? {}), username },
    })

    // 3) ★過去データを一括更新（posts / room_members）
    // posts
    const { error: postUpdErr } = await supabaseAdmin
      .from('posts')
      .update({ username })
      .eq('user_id', user.id)

    if (postUpdErr) {
      return NextResponse.json({ ok: false, error: `posts update failed: ${postUpdErr.message}` }, { status: 400 })
    }

    // room_members（表示用）
    const { error: memUpdErr } = await supabaseAdmin
      .from('room_members')
      .update({ username })
      .eq('user_id', user.id)

    if (memUpdErr) {
      return NextResponse.json({ ok: false, error: `room_members update failed: ${memUpdErr.message}` }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
