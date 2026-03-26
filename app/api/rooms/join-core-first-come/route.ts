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

function parseConsent(body: any) {
  const consent = body?.consent ?? {}
  const roomTermsVersion = String(consent?.roomTermsVersion ?? '').trim()
  const roomAgreedAt = String(consent?.roomAgreedAt ?? '').trim()
  const forcedPublishAckAt = String(consent?.forcedPublishAckAt ?? '').trim()
  const coreLockAgreedAt = String(consent?.coreLockAgreedAt ?? '').trim()

  if (!roomTermsVersion || !roomAgreedAt || !forcedPublishAckAt || !coreLockAgreedAt) {
    return { ok: false as const, error: 'core参加同意情報が不足しています' }
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
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })

    const consentResult = parseConsent(body)
    if (!consentResult.ok) {
      return NextResponse.json({ ok: false, error: consentResult.error }, { status: 400 })
    }

    const { userId, error } = await getUserIdFromBearer(req)
    if (!userId) return NextResponse.json({ ok: false, error }, { status: 401 })

    const { url, serviceKey } = getEnv()
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const { data, error: rpcErr } = await admin.rpc('join_core_first_come', {
      p_room_id: roomId,
      p_user_id: userId,
    })

    if (rpcErr) {
      const msg = rpcErr.message || '参加に失敗しました'

      if (msg.includes('ROOM_NOT_FOUND')) return NextResponse.json({ ok: false, error: 'ルームが見つかりません' }, { status: 404 })
      if (msg.includes('ROOM_NOT_OPEN')) return NextResponse.json({ ok: false, error: 'openルームのみ参加できます' }, { status: 400 })
      if (msg.includes('APPROVAL_ON')) return NextResponse.json({ ok: false, error: 'このルームは承認制です（先着参加はできません）' }, { status: 400 })
      if (msg.includes('ALREADY_JOINED')) return NextResponse.json({ ok: false, error: 'すでに参加しています' }, { status: 409 })
      if (msg.includes('CORE_FULL')) return NextResponse.json({ ok: false, error: 'core枠が埋まりました（最大5）' }, { status: 409 })

      return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }

    const {
      roomTermsVersion,
      roomAgreedAt,
      forcedPublishAckAt,
      coreLockAgreedAt,
    } = consentResult.value

    const { error: updateErr } = await admin
      .from('room_members')
      .update({
        room_terms_version: roomTermsVersion,
        room_agreed_at: roomAgreedAt,
        forced_publish_ack_at: forcedPublishAckAt,
        core_lock_agreed_at: coreLockAgreedAt,
      })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .is('left_at', null)

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}