// app/api/reports/create/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // --- auth ---
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = userRes.user

    // --- body ---
    const body = await req.json()
    const targetType = String(body.targetType ?? '').trim() // 'room' | 'post'
    const targetId = String(body.targetId ?? '').trim()
    const reason = String(body.reason ?? '').trim()
    const detail = String(body.detail ?? '').trim()

    if (!['room', 'post'].includes(targetType)) {
      return NextResponse.json({ ok: false, error: 'targetType must be room or post' }, { status: 400 })
    }
    if (!targetId) return NextResponse.json({ ok: false, error: 'targetId is required' }, { status: 400 })
    if (!reason) return NextResponse.json({ ok: false, error: 'reason is required' }, { status: 400 })
    if (detail.length > 2000) return NextResponse.json({ ok: false, error: 'detail too long (max 2000)' }, { status: 400 })

    // ついでに存在チェック（最小）
    if (targetType === 'room') {
      const { data: room } = await supabaseAdmin.from('rooms').select('id, deleted_at').eq('id', targetId).maybeSingle()
      if (!room || room.deleted_at) return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })
    }
    if (targetType === 'post') {
      const { data: post } = await supabaseAdmin.from('posts').select('id').eq('id', targetId).maybeSingle()
      if (!post) return NextResponse.json({ ok: false, error: 'post not found' }, { status: 404 })
    }

    const { data: report, error: insErr } = await supabaseAdmin
      .from('reports')
      .insert({
        reporter_user_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason,
        detail: detail || null,
      })
      .select('id, target_type, target_id, reason, detail, created_at, status')
      .single()

    if (insErr || !report) return NextResponse.json({ ok: false, error: insErr?.message ?? 'insert failed' }, { status: 400 })

    return NextResponse.json({ ok: true, report })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
