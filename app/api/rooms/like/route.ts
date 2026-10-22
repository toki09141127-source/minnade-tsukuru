import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'
import { limitAction } from '../../../../lib/apiGuards'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ ok: false, error: 'ログインしてください' }, { status: 401 })
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token)
    const uid = data.user?.id
    if (authError || !uid) return NextResponse.json({ ok: false, error: 'ログインしてください' }, { status: 401 })
    const body = await req.json().catch(() => null)
    const roomId = typeof body?.roomId === 'string' ? body.roomId.trim() : ''
    if (!roomId) return NextResponse.json({ ok: false, error: 'ルームを指定してください' }, { status: 400 })
    const limited = await limitAction(supabaseAdmin, uid, 'like')
    if (limited) return limited
    if(process.env.MVP_LIKE_REQUESTS_ENABLED==='true'){
      const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if(typeof body?.expected!=='boolean'||typeof body?.desired!=='boolean'||!uuid.test(body?.requestId??''))
        return NextResponse.json({ok:false,error:'一覧を更新して操作してください'},{status:400,headers:{'Cache-Control':'no-store'}})
      const {data:liked,error}=await supabaseAdmin.rpc('mvp_set_room_like',{
        p_actor:uid,p_room:roomId,p_expected:body.expected,p_desired:body.desired,p_request:body.requestId,
      })
      if(error||typeof liked!=='boolean')return NextResponse.json({ok:false,error:'状態を確認できません。同じ操作の再試行、または再読み込みで確認してください'},{status:409,headers:{'Cache-Control':'no-store'}})
      return NextResponse.json({ok:true,liked},{headers:{'Cache-Control':'no-store'}})
    }
    return NextResponse.json({ok:false,error:'現在この機能は利用できません。時間をおいてお試しください。'}, {status:503,headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({ ok: false, error: '更新できませんでした' }, { status: 503 })
  }
}
