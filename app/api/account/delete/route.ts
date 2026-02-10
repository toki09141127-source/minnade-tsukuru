// app/api/account/delete/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

function getBearer(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return jwt
}

export async function POST(req: Request) {
  try {
    const jwt = getBearer(req)
    if (!jwt) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    // ✅ Bearer(JWT)で本人確認（anon client）
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    )

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser()
    const user = userData?.user
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    const userId = user.id

    // ✅ 管理者クライアント（service role）
    const admin = createAdminClient()

    // 1) profiles を「退会ユーザー」に匿名化（あなたのprofiles列に合わせて調整OK）
    const { error: profErr } = await admin
      .from('profiles')
      .update({
        display_name: '退会ユーザー',
        avatar_url: null,
        bio: null,
        deleted_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 })
    }

    // 2) Authユーザーを削除（supabase-js v2）
    // ※もしプロジェクト設定や権限で失敗しても、profiles匿名化は完了してるので ok 返す運用も可能
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) {
      // ここは「失敗にする」か「匿名化はできたのでOK扱い」にするか好み
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'failed' }, { status: 500 })
  }
}
