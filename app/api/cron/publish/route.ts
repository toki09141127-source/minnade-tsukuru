// app/api/cron/publish/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const key = url.searchParams.get('key')

    const secret = process.env.CRON_SECRET

    // ===== デバッグ情報 =====
    const nowIso = new Date().toISOString()
    const isVercel = !!process.env.VERCEL
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY

    // secret 未設定
    if (!secret) {
      return NextResponse.json(
        {
          ok: false,
          error: 'CRON_SECRET is not set',
          debug: { nowIso, isVercel, hasServiceRole },
        },
        { status: 500 }
      )
    }

    // 認証失敗
    if (!key || key !== secret) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Unauthorized',
          debug: { nowIso, isVercel, hasServiceRole },
        },
        { status: 401 }
      )
    }

    // ===== 期限切れルームを forced_publish に更新 =====
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .update({ status: 'forced_publish' })
      .eq('status', 'open')
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso)
      .select('id')

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          debug: { nowIso, isVercel, hasServiceRole },
        },
        { status: 400 }
      )
    }

    // ===== 成功レスポンス（デバッグ付き）=====
    return NextResponse.json({
      ok: true,
      updated: data?.length ?? 0,
      debug: {
        nowIso,
        isVercel,
        hasServiceRole,
        checkedStatus: 'open',
        condition: 'expires_at <= now',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? 'server error',
      },
      { status: 500 }
    )
  }
}
