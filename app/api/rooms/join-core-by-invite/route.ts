// app/api/rooms/join-core-by-invite/route.ts
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
    const inviteCode = String(body?.inviteCode ?? '').trim()
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })
    if (!inviteCode) return NextResponse.json({ ok: false, error: 'inviteCode is required' }, { status: 400 })

    const { userId, error } = await getUserIdFromBearer(req)
    if (!userId) return NextResponse.json({ ok: false, error }, { status: 401 })

    const { url, serviceKey } = getEnv()
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, status, enable_core_invite, core_invite_code')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ ok: false, error: roomErr.message }, { status: 500 })
    if (!room) return NextResponse.json({ ok: false, error: 'ルームが見つかりません' }, { status: 404 })
    if (room.status !== 'open') return NextResponse.json({ ok: false, error: 'openルームのみ参加できます' }, { status: 400 })
    if (!room.enable_core_invite) return NextResponse.json({ ok: false, error: 'このルームは招待コード参加がOFFです' }, { status: 400 })
    if (!room.core_invite_code || room.core_invite_code !== inviteCode) {
      return NextResponse.json({ ok: false, error: '招待コードが違います' }, { status: 403 })
    }

    // 既に参加済みならOK
    const { data: existing } = await admin
      .from('room_members')
      .select('role, left_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing && existing.left_at == null && (existing.role === 'core' || existing.role === 'creator')) {
      return NextResponse.json({ ok: true, joined: true, role: existing.role })
    }

    // core枠チェック（creator含む最大5、left_at null の creator/core を数える）
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

    // upsert core（即時core）
    const now = new Date().toISOString()
    const { error: upErr } = await admin.from('room_members').upsert(
      {
        room_id: roomId,
        user_id: userId,
        role: 'core',
        joined_at: now,
        left_at: null,
        approved_at: now,
        approved_by: null,
      },
      { onConflict: 'room_id,user_id' }
    )

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, joined: true, role: 'core' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
