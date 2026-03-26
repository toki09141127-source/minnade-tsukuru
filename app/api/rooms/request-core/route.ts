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

function parseConsent(body: any) {
  const consent = body?.consent ?? {}
  const roomTermsVersion = String(consent?.roomTermsVersion ?? '').trim()
  const roomAgreedAt = String(consent?.roomAgreedAt ?? '').trim()
  const forcedPublishAckAt = String(consent?.forcedPublishAckAt ?? '').trim()
  const coreLockAgreedAt = String(consent?.coreLockAgreedAt ?? '').trim()

  if (!roomTermsVersion || !roomAgreedAt || !forcedPublishAckAt || !coreLockAgreedAt) {
    return { ok: false as const, error: 'core申請同意情報が不足しています' }
  }

  return {
    ok: true as const,
    value: {
      roomTermsVersion,
      roomAgreedAt,
      forcedPublishAckAt,
      coreLockAgreedAt,
    },
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = String(body?.roomId ?? '').trim()
    if (!roomId) {
      return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })
    }

    const consentResult = parseConsent(body)
    if (!consentResult.ok) {
      return NextResponse.json({ ok: false, error: consentResult.error }, { status: 400 })
    }

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
    if (room.status !== 'open') {
      return NextResponse.json({ ok: false, error: 'openルームのみ申請できます' }, { status: 400 })
    }
    if (!room.enable_core_approval) {
      return NextResponse.json({ ok: false, error: 'このルームは承認制がOFFです' }, { status: 400 })
    }

    const { data: mem } = await admin
      .from('room_members')
      .select('role, left_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (mem && mem.left_at == null && (mem.role === 'core' || mem.role === 'creator')) {
      return NextResponse.json({ ok: true, requested: false, message: 'すでにcoreです' })
    }

    const { data: existingReq, error: reqErr } = await admin
      .from('room_join_requests')
      .select('id, status')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (reqErr) return NextResponse.json({ ok: false, error: reqErr.message }, { status: 500 })
    if (existingReq) return NextResponse.json({ ok: true, requested: true, requestId: existingReq.id })

    const {
      roomTermsVersion,
      roomAgreedAt,
      forcedPublishAckAt,
      coreLockAgreedAt,
    } = consentResult.value

    const { data: ins, error: insErr } = await admin
      .from('room_join_requests')
      .insert({
        room_id: roomId,
        user_id: userId,
        requested_role: 'core',
        status: 'pending',
        room_terms_version: roomTermsVersion,
        room_agreed_at: roomAgreedAt,
        forced_publish_ack_at: forcedPublishAckAt,
        core_lock_agreed_at: coreLockAgreedAt,
      })
      .select('id')
      .maybeSingle()

    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, requested: true, requestId: ins?.id ?? null })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'server error' },
      { status: 500 }
    )
  }
}