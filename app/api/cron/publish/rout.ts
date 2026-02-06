// app/api/cron/publish/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // ?key=... で受ける
    const url = new URL(req.url)
    const key = url.searchParams.get('key')

    const secret = process.env.CRON_SECRET
    if (!secret) {
      return NextResponse.json({ ok: false, error: 'CRON_SECRET is not set' }, { status: 500 })
    }

    if (!key || key !== secret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 期限切れのルームを forced_publish にする例
    const nowIso = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .update({ status: 'forced_publish' })
      .eq('status', 'open')
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso)
      .select('id')

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, updated: data?.length ?? 0 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
