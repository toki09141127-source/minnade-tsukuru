// app/api/rooms/request-core/route.ts
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
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })

    const { userId, error } = await getUserIdFromBearer(req)
    if (!userId) return NextResponse.json({ ok: false, error }, { status: 401 })

    const { url, serviceKey } = getEnv()
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, status, enable_core_approval')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ ok: false, error: roomErr.message }, { status: 500 })
    if (!room) return NextResponse.json({ ok: false, error: 'ルームが見つかりません' }, { status: 404 })
    if (room.status !== 'open') return NextResponse.json({ ok: false, error: 'openルームのみ申請できます' }, { status: 400 })
    if (!room.enable_core_approval) return NextResponse.json({ ok: false, error: 'このルームは承認制がOFFです' }, { status: 400 })

    // 既に core/creator なら申請不要
    const { data: mem } = await admin
      .from('room_members')
      .select('role, left_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (mem && mem.left_at == null && (mem.role === 'core' || mem.role === 'creator')) {
      return NextResponse.json({ ok: true, requested: false, message: 'すでにcoreです' })
    }

    // pending があれば再作成しない
    const { data: existingReq, error: reqErr } = await admin
      .from('room_join_requests')
      .select('id, status')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (reqErr) return NextResponse.json({ ok: false, error: reqErr.message }, { status: 500 })
    if (existingReq) return NextResponse.json({ ok: true, requested: true, requestId: existingReq.id })

    const { data: ins, error: insErr } = await admin
      .from('room_join_requests')
      .insert({
        room_id: roomId,
        user_id: userId,
        requested_role: 'core',
        status: 'pending',
      })
      .select('id')
      .maybeSingle()

    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, requested: true, requestId: ins?.id ?? null })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
