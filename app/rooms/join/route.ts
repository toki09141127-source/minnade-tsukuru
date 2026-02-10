// app/api/rooms/join/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = String(body?.roomId ?? '').trim()
    if (!roomId) {
      return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })
    }

    // --- Auth: Bearer token ---
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }
    const user = userData.user

    // --- Admin insert ---
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // ルーム存在チェック（ついでに open かも確認）
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

    // 参加（既に参加済みでもOKにする）
    // left_at がある設計なら null に戻す（あなたは left_at で詰まったので入れておく）
    const { error: upsertErr } = await admin
      .from('room_members')
      .upsert(
        {
          room_id: roomId,
          user_id: user.id,
          role: 'supporter', // コア招待は別処理にする前提
          left_at: null,
        },
        { onConflict: 'room_id,user_id' }
      )

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
