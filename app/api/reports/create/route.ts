// app/api/reports/create/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ ok: false, error: 'ログインしてください' }, { status: 401 })
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'ログインしてください' }, { status: 401 })
    }
    const user = userRes.user

    const body = await req.json().catch(() => ({} as any))

    const targetType = String(body?.targetType ?? '')
    const targetId = String(body?.targetId ?? '').trim()

    // ✅ reason 必須化：null/undefined/空白は 400
    const reasonRaw = body?.reason
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : ''

    if (!targetType || (targetType !== 'room' && targetType !== 'post')) {
      return NextResponse.json({ ok: false, error: 'invalid targetType' }, { status: 400 })
    }
    if (!targetId) {
      return NextResponse.json({ ok: false, error: 'targetId is required' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json(
        { ok: false, error: '通報理由を入力してください' },
        { status: 400 }
      )
    }

    // ✅ DBの schema に合わせる：reports は reporter_user_id / target_type / target_id / reason
    const insertPayload = {
      reporter_user_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason, // ✅ null 絶対禁止（trim済み）
    }

    const { error } = await supabaseAdmin.from('reports').insert(insertPayload)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
