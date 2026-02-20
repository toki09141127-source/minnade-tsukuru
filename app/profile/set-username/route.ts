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

    const body = await req.json().catch(() => ({}))
    const username = String((body as any).username ?? '').trim()

    if (username.length < 2 || username.length > 20) {
      return NextResponse.json({ ok: false, error: 'username must be 2-20 chars' }, { status: 400 })
    }

    // ① profiles 更新（存在しなければ insert、あれば update）
    const { error: upsertErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: user.id, username }, { onConflict: 'id' })

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 400 })
    }

    // ② public_profiles 同期（username必須なのでここで確実に作る）
    // 既存の公開情報（bio/links/avatar_url）を壊さないために読んで合成
    const { data: pub, error: pubErr } = await supabaseAdmin
      .from('public_profiles')
      .select('bio, links, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (pubErr) {
      return NextResponse.json({ ok: false, error: pubErr.message }, { status: 500 })
    }

    const { error: pubUpErr } = await supabaseAdmin.from('public_profiles').upsert(
      {
        id: user.id,
        username,
        bio: (pub?.bio ?? null) as string | null,
        links: (pub?.links ?? null) as any,
        avatar_url: (pub?.avatar_url ?? null) as string | null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    if (pubUpErr) {
      return NextResponse.json({ ok: false, error: pubUpErr.message }, { status: 500 })
    }

    // ③ 過去投稿の username を一括更新（任意だが体験が良くなる）
    await supabaseAdmin.from('posts').update({ username }).eq('user_id', user.id)

    // ④ 参加者表示も一括更新
    await supabaseAdmin.from('room_members').update({ username }).eq('user_id', user.id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
