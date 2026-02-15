// app/api/rooms/reject-core/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return { url, anonKey, serviceKey }
}

async function getUserIdFromBearer(req: Request) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return { userId: null, error: 'Unauthorized' }

  const { url, anonKey } = getEnv()
  const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return { userId: null, error: 'Unauthorized' }
  return { userId: data.user.id, error: null }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = String(body?.roomId ?? '').trim()
    const requestId = String(body?.requestId ?? '').trim()
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })
    if (!requestId) return NextResponse.json({ ok: false, error: 'requestId is required' }, { status: 400 })

    const { userId, error } = await getUserIdFromBearer(req)
    if (!userId) return NextResponse.json({ ok: false, error }, { status: 401 })

    const { url, serviceKey } = getEnv()
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // creator確認
    const { data: me } = await admin
      .from('room_members')
      .select('role, left_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!me || me.left_at != null || me.role !== 'creator') {
      return NextResponse.json({ ok: false, error: 'creatorのみ却下できます' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const { error: updErr } = await admin
      .from('room_join_requests')
      .update({ status: 'rejected', decided_at: now, decided_by: userId })
      .eq('id', requestId)
      .eq('room_id', roomId)
      .eq('status', 'pending')

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
