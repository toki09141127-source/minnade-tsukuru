import { limitAction } from '../../../../lib/apiGuards'
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

function parseConsent(body: { consent?: Record<string, unknown> } | null) {
  const consent = body?.consent ?? {}
  const roomTermsVersion = String(consent?.roomTermsVersion ?? '').trim()
  const roomAgreedAt = String(consent?.roomAgreedAt ?? '').trim()
  const forcedPublishAckAt = String(consent?.forcedPublishAckAt ?? '').trim()

  if (!roomTermsVersion || !roomAgreedAt || !forcedPublishAckAt) {
    return { ok: false as const, error: 'ルーム参加同意情報が不足しています' }
  }

  return {
    ok: true as const,
    value: {
      roomTermsVersion,
      roomAgreedAt,
      forcedPublishAckAt,
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
    const limited = await limitAction(admin, userId, 'join')
    if (limited) return limited

    if (process.env.MVP_ATOMIC_JOIN_ENABLED === 'true') {
      const { data, error: joinError } = await admin.rpc('mvp_join_member', {
        p_actor: userId, p_room: roomId, p_terms: consentResult.value.roomTermsVersion,
      })
      const headers = { 'Cache-Control': 'no-store' }
      if (joinError) {
        const full = joinError.message === 'MEMBER_FULL'
        return NextResponse.json({ ok: false, error: full ? 'Member枠が満員です（最大45）' : '参加できません。ルーム状態と同意内容を確認してください' },
          { status: full ? 409 : 403, headers })
      }
      if (!['creator', 'core', 'supporter'].includes(data))
        return NextResponse.json({ ok: false, error: '参加結果を確認できません。再読み込みしてください' }, { status: 503, headers })
      return NextResponse.json({ ok: true, joined: true, role: data }, { headers })
    }
    return NextResponse.json({ok:false,error:'現在この機能は利用できません。時間をおいてお試しください。'}, {status:503,headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json(
      { ok: false, error: '処理に失敗しました。時間をおいてお試しください' },
      { status: 500 }
    )
  }
}