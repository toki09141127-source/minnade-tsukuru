// app/api/reports/create/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

    const url = new URL(req.url)
    const debug = url.searchParams.get('debug') === '1'

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'ログインしてください', ...(debug ? { debug: { hasToken: false } } : {}) },
        { status: 401 }
      )
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json(
        {
          ok: false,
          error: 'ログインしてください',
          ...(debug ? { debug: { hasToken: true, userOk: false } } : {}),
        },
        { status: 401 }
      )
    }
    const user = userRes.user

    const body = await req.json().catch(() => ({} as any))
    const targetType = String(body?.targetType ?? '').trim()
    const targetId = String(body?.targetId ?? '').trim()
    const reason = String(body?.reason ?? '').trim()

    if (targetType !== 'room' && targetType !== 'post') {
      return NextResponse.json({ ok: false, error: 'invalid targetType' }, { status: 400 })
    }
    if (!targetId) {
      return NextResponse.json({ ok: false, error: 'targetId is required' }, { status: 400 })
    }

    // ✅ DBスキーマに合わせる（reports: reporter_user_id, target_type, target_id, reason）
    const insertPayload = {
      reporter_user_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason: reason || null,
    }

    const { error: insErr } = await supabaseAdmin.from('reports').insert(insertPayload)

    if (insErr) {
      // 例：重複通報 unique index 等
      return NextResponse.json(
        {
          ok: false,
          error: insErr.message,
          ...(debug
            ? {
                debug: {
                  hasToken: true,
                  userOk: true,
                  userIdPrefix: user.id.slice(0, 8),
                  targetType,
                  targetIdPrefix: targetId.slice(0, 8),
                  payloadKeys: Object.keys(insertPayload),
                },
              }
            : {}),
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        ...(debug
          ? {
              debug: {
                hasToken: true,
                userOk: true,
                userIdPrefix: user.id.slice(0, 8),
                targetType,
                targetIdPrefix: targetId.slice(0, 8),
                payloadKeys: Object.keys(insertPayload),
              },
            }
          : {}),
      },
      { status: 200 }
    )
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
