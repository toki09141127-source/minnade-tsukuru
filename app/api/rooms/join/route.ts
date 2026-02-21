// app/api/rooms/join/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return { url, anonKey, serviceKey }
}

async function getUserFromBearer(req: Request) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return { user: null, error: 'Not authenticated' as const }

  const { url, anonKey } = getEnv()
  const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return { user: null, error: 'Not authenticated' as const }
  return { user: data.user, error: null }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = String(body?.roomId ?? '').trim()
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })

    const { user, error } = await getUserFromBearer(req)
    if (!user) return NextResponse.json({ ok: false, error }, { status: 401 })

    const { url, serviceKey } = getEnv()
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // ルーム存在チェック + openのみ参加
    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, status, is_hidden, deleted_at')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ ok: false, error: roomErr.message }, { status: 500 })
    if (!room || room.is_hidden || room.deleted_at) {
      return NextResponse.json({ ok: false, error: 'ルームが見つかりません' }, { status: 404 })
    }
    if (room.status !== 'open') {
      return NextResponse.json({ ok: false, error: `このルームは ${room.status} のため参加できません` }, { status: 400 })
    }

    // username を profiles から取得（null対策）
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (profErr) return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 })

    const username = (profile?.username ?? '名無し').toString()
    const nowIso = new Date().toISOString()

    // 参加（復帰含む）
    const { error: upsertErr } = await admin
      .from('room_members')
      .upsert(
        {
          room_id: roomId,
          user_id: user.id,
          username,
          role: 'supporter',      // core招待は別処理
          left_at: null,
          last_seen_at: nowIso,   // ✅ join直後は未読0
        },
        { onConflict: 'room_id,user_id' }
      )

    if (upsertErr) return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 })
  }
}