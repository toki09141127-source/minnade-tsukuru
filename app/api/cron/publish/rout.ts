import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const key = url.searchParams.get('key') ?? ''
  const secret = process.env.CRON_SECRET ?? ''

  if (!secret || key !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  const { data: rooms, error } = await supabaseAdmin
    .from('rooms')
    .select('id')
    .eq('status', 'open')
    .not('expires_at', 'is', null)
    .lte('expires_at', now)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const ids = (rooms ?? []).map((r) => r.id)
  if (ids.length === 0) return NextResponse.json({ ok: true, updated: 0 })

  const { error: updErr } = await supabaseAdmin.from('rooms').update({ status: 'forced_publish' }).in('id', ids)
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, updated: ids.length })
}
