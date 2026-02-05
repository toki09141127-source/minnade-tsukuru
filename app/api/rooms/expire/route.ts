import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export async function POST() {
  const now = new Date().toISOString()

  // expires_at <= now の open を forced_publish に
  const { error } = await supabaseAdmin
    .from('rooms')
    .update({ status: 'forced_publish' })
    .eq('status', 'open')
    .lte('expires_at', now)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
