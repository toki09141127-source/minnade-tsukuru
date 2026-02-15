// app/api/rooms/approve-core/route.ts
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

    // creator確認（left_at null）
    const { data: me } = await admin
      .from('room_members')
      .select('role, left_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!me || me.left_at != null || me.role !== 'creator') {
      return NextResponse.json({ ok: false, error: 'creatorのみ承認できます' }, { status: 403 })
    }

    // request取得
    const { data: reqRow, error: reqErr } = await admin
      .from('room_join_requests')
      .select('id, room_id, user_id, status')
      .eq('id', requestId)
      .maybeSingle()

    if (reqErr) return NextResponse.json({ ok: false, error: reqErr.message }, { status: 500 })
    if (!reqRow || reqRow.room_id !== roomId) {
      return NextResponse.json({ ok: false, error: 'request not found' }, { status: 404 })
    }
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ ok: false, error: 'pendingのみ承認できます' }, { status: 400 })
    }

    // core枠チェック（creator含む最大5）
    const { count: coreCount, error: cntErr } = await admin
      .from('room_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .in('role', ['creator', 'core'])
      .is('left_at', null)

    if (cntErr) return NextResponse.json({ ok: false, error: cntErr.message }, { status: 500 })
    if ((coreCount ?? 0) >= 5) {
      return NextResponse.json({ ok: false, error: 'core枠が満員です（最大5）' }, { status: 409 })
    }

    const now = new Date().toISOString()

    // requestをapproved
    const { error: updErr } = await admin
      .from('room_join_requests')
      .update({ status: 'approved', decided_at: now, decided_by: userId })
      .eq('id', requestId)
      .eq('status', 'pending')

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })

    // memberをcoreに（upsert）
    const { error: upErr } = await admin.from('room_members').upsert(
      {
        room_id: roomId,
        user_id: reqRow.user_id,
        role: 'core',
        joined_at: now,
        left_at: null,
        approved_at: now,
        approved_by: userId,
      },
      { onConflict: 'room_id,user_id' }
    )

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
