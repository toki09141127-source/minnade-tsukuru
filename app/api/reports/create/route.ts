// app/api/reports/create/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const user = userRes.user

    const body = await req.json()
    const targetType = String(body.targetType ?? '')
    const targetId = String(body.targetId ?? '').trim()
    const reason = String(body.reason ?? '').trim()

    if (!targetType || (targetType !== 'room' && targetType !== 'post')) {
      return NextResponse.json({ ok: false, error: 'invalid targetType' }, { status: 400 })
    }
    if (!targetId) return NextResponse.json({ ok: false, error: 'targetId is required' }, { status: 400 })

    const insertPayload: any = {
      reporter_id: user.id,
      target_type: targetType,
      reason: reason || null,
      target_room_id: null,
      target_post_id: null,
    }

    if (targetType === 'room') insertPayload.target_room_id = targetId
    if (targetType === 'post') insertPayload.target_post_id = targetId

    const { error } = await supabaseAdmin.from('reports').insert(insertPayload)

    if (error) {
      // 例：重複通報 unique index によるエラー
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
