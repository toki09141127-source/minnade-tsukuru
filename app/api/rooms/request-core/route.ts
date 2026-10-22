import { limitAction } from '../../../../lib/apiGuards'
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

function parseConsent(body: { consent?: Record<string, unknown> } | null) {
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
    const limited = await limitAction(admin, userId, 'core')
    if (limited) return limited
    if (process.env.MVP_ATOMIC_CORE_ENABLED !== 'true')
      return NextResponse.json({ok:false,error:'Core申請は準備中です'}, {status:503,headers:{'Cache-Control':'no-store'}})

    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, status, enable_core_approval, is_hidden, deleted_at')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ ok: false, error: '処理に失敗しました。時間をおいてお試しください' }, { status: 500 })
    if (!room || room.is_hidden !== false || room.deleted_at != null) return NextResponse.json({ ok: false, error: 'ルームが見つかりません' }, { status: 404 })
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

    if (!mem || mem.left_at != null || mem.role !== 'supporter')
      return NextResponse.json({ok:false,error:'参加中のMemberのみ申請できます'}, {status:403})
    const {data:requestId,error:requestError}=await admin.rpc('mvp_request_core',{
      p_actor:userId,p_room:roomId,p_terms:consentResult.value.roomTermsVersion,
    })
    if(requestError) return NextResponse.json({ok:false,error:'申請できません。参加状態・同意・申請回数を確認してください'}, {status:409,headers:{'Cache-Control':'no-store'}})
    return NextResponse.json({ok:true,requested:true,requestId}, {headers:{'Cache-Control':'no-store'}})

  } catch {
    return NextResponse.json(
      { ok: false, error: '処理に失敗しました。時間をおいてお試しください' },
      { status: 500 }
    )
  }
}