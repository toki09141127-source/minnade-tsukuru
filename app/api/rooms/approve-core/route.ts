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
  if (!token) return { userId: null as string | null, error: 'Unauthorized' }

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

    const { data: reqRow, error: reqRowErr } = await admin
      .from('room_join_requests')
      .select(
        'id, user_id, room_terms_version, room_agreed_at, forced_publish_ack_at, core_lock_agreed_at'
      )
      .eq('id', requestId)
      .eq('room_id', roomId)
      .maybeSingle()

    if (reqRowErr) {
      return NextResponse.json({ ok: false, error: reqRowErr.message }, { status: 500 })
    }
    if (!reqRow) {
      return NextResponse.json({ ok: false, error: '申請が見つかりません' }, { status: 404 })
    }

    const { data, error: rpcErr } = await admin.rpc('approve_core_request', {
      p_room_id: roomId,
      p_creator_user_id: userId,
      p_request_id: requestId,
    })

    if (rpcErr) {
      const msg = rpcErr.message || '承認に失敗しました'

      if (msg.includes('NOT_CREATOR')) return NextResponse.json({ ok: false, error: 'creatorのみ承認できます' }, { status: 403 })
      if (msg.includes('REQUEST_NOT_FOUND')) return NextResponse.json({ ok: false, error: '申請が見つかりません' }, { status: 404 })
      if (msg.includes('NOT_PENDING')) return NextResponse.json({ ok: false, error: 'pendingのみ承認できます' }, { status: 400 })
      if (msg.includes('CORE_FULL')) return NextResponse.json({ ok: false, error: 'core枠が満員です（最大5）' }, { status: 409 })

      return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }

    const { error: updateErr } = await admin
      .from('room_members')
      .update({
        room_terms_version: reqRow.room_terms_version,
        room_agreed_at: reqRow.room_agreed_at,
        forced_publish_ack_at: reqRow.forced_publish_ack_at,
        core_lock_agreed_at: reqRow.core_lock_agreed_at,
      })
      .eq('room_id', roomId)
      .eq('user_id', reqRow.user_id)
      .is('left_at', null)

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}