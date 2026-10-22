import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: '公開処理を利用できません' }, { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    if (process.env.MVP_DRAFTS_ENABLED === 'true') {
      const {data,error}=await supabaseAdmin.rpc('mvp_publish_due')
      if(error) return NextResponse.json({ok:false,error:'公開処理に失敗しました'}, {status:503})
      return NextResponse.json({ok:true,updated:data})
    }
    return NextResponse.json({ok:false,error:'現在この機能は利用できません。時間をおいてお試しください。'}, {status:503,headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({ ok: false, error: '公開処理に失敗しました' }, { status: 503 })
  }
}
