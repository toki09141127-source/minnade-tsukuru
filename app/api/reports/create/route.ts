import { limitAction } from '../../../../lib/apiGuards'
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
    const limited = await limitAction(supabaseAdmin, user.id, 'reports')
    if (limited) return limited

    const body = await req.json().catch(() => ({}))

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
    if (reason.length > 2000) return NextResponse.json({ ok: false, error: '通報理由は2000文字以内で入力してください' }, { status: 400 })
    if (!reason) {
      return NextResponse.json(
        { ok: false, error: '通報理由を入力してください' },
        { status: 400 }
      )
    }

    if (process.env.MVP_REPORT_INTAKE_ENABLED === 'true') {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (typeof body.requestId !== 'string' || !uuid.test(body.requestId) || !uuid.test(targetId))
        return NextResponse.json({ok:false,error:'通報情報を確認してください'}, {status:400})
      const {data,error}=await supabaseAdmin.rpc('mvp_receive_report',{
        p_actor:user.id,p_request:body.requestId,p_type:targetType,p_target:targetId,p_reason:reason,
      })
      if(error?.message==='ALREADY_REPORTED')return NextResponse.json({ok:false,error:'この対象の通報は既に受け付けています'}, {status:409,headers:{'Cache-Control':'no-store'}})
      const receipt=Array.isArray(data) && data.length===1 ? data[0] : null
      if(error || !receipt || typeof receipt.receipt_id!=='string' ||
        !['pending','processed'].includes(receipt.processing_state))
        return NextResponse.json({ok:false,error:'受付を確認できませんでした。同じ内容で再試行してください'}, {status:503,headers:{'Cache-Control':'no-store'}})
      return NextResponse.json({ok:true,receiptId:receipt.receipt_id,processingState:receipt.processing_state},
        {status:receipt.processing_state==='pending'?202:200,headers:{'Cache-Control':'no-store'}})
    }
    return NextResponse.json({ok:false,error:'現在この機能は利用できません。時間をおいてお試しください。'}, {status:503,headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({ ok: false, error: '通報を送信できませんでした' }, { status: 500 })
  }
}
