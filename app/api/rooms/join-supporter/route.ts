// app/api/rooms/join-supporter/route.ts
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

    // ルーム確認
    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ ok: false, error: roomErr.message }, { status: 500 })
    if (!room) return NextResponse.json({ ok: false, error: 'ルームが見つかりません' }, { status: 404 })
    if (room.status !== 'open') {
      return NextResponse.json({ ok: false, error: `このルームは ${room.status} のため参加できません` }, { status: 400 })
    }

    // 既に参加済み（left_at null）なら OK
    const { data: existing, error: exErr } = await admin
      .from('room_members')
      .select('role, left_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 })
    if (existing && existing.left_at == null) {
      return NextResponse.json({ ok: true, joined: true, role: existing.role })
    }

    // supporter枠チェック（active supporter <=45）
    const { count: supporterCount, error: cntErr } = await admin
      .from('room_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('role', 'supporter')
      .is('left_at', null)

    if (cntErr) return NextResponse.json({ ok: false, error: cntErr.message }, { status: 500 })
    if ((supporterCount ?? 0) >= 45) {
      return NextResponse.json({ ok: false, error: 'supporter枠が満員です（最大45）' }, { status: 409 })
    }

    // upsert：supporterとして参加（再参加なら left_at を null に戻す）
    const { error: upErr } = await admin.from('room_members').upsert(
      {
        room_id: roomId,
        user_id: userId,
        role: 'supporter',
        joined_at: new Date().toISOString(),
        left_at: null,
        approved_at: null,
        approved_by: null,
      },
      { onConflict: 'room_id,user_id' }
    )

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, joined: true, role: 'supporter' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
