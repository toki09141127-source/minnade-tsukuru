// app/api/reports/create/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // --- auth ---
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = userRes.user

    // --- body ---
    const body = await req.json().catch(() => ({}))

    // ✅ 互換：camelCase / snake_case どちらでも受ける
    const targetType = String(body.targetType ?? body.target_type ?? '').trim()
    const targetId = String(body.targetId ?? body.target_id ?? '').trim()
    const reason = String(body.reason ?? '').trim()

    if (!targetType || (targetType !== 'room' && targetType !== 'post')) {
      return NextResponse.json({ ok: false, error: 'invalid targetType' }, { status: 400 })
    }
    if (!targetId) {
      return NextResponse.json({ ok: false, error: 'targetId is required' }, { status: 400 })
    }
    if (reason.length > 500) {
      return NextResponse.json({ ok: false, error: 'reason is too long (max 500)' }, { status: 400 })
    }

    // ✅ reporter_user_id を必ず入れる（NOT NULL対策の本丸）
    const insertPayload: any = {
      reporter_user_id: user.id,
      target_type: targetType,
      reason: reason || null,
      target_room_id: null,
      target_post_id: null,
    }

    if (targetType === 'room') insertPayload.target_room_id = targetId
    if (targetType === 'post') insertPayload.target_post_id = targetId

    // --- debug (DEV only) ---
    if (process.env.NODE_ENV !== 'production') {
      console.log('[reports/create]', {
        userIdPresent: !!user.id,
        targetType,
        targetIdPresent: !!targetId,
        reasonPresent: !!(reason || null),
      })
    }

    const { error: insErr } = await supabaseAdmin.from('reports').insert(insertPayload)

    if (insErr) {
      // 例：重複通報 unique index によるエラー等
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
