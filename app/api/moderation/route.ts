import { limitAction } from '@/lib/apiGuards'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
export async function POST(req: Request) {
  if(process.env.V2_ENABLED==='true'&&process.env.NEXT_PUBLIC_SUPABASE_URL==='https://fwqucffxdmbdczspkcyr.supabase.co') return NextResponse.json({error:'運営コンソールを利用してください'}, {status:410,headers:{'Cache-Control':'no-store'}})
  try {
    const auth=req.headers.get('authorization') ?? ''
    if(!auth.startsWith('Bearer ')) return NextResponse.json({error:'ログインしてください'}, {status:401})
    const {data,error}=await supabaseAdmin.auth.getUser(auth.slice(7))
    if(error || !data.user) return NextResponse.json({error:'ログインしてください'}, {status:401})
    if(process.env.MVP_MODERATION_ENABLED!=='true') return NextResponse.json({error:'運営機能は準備中です'}, {status:503})
    const limited=await limitAction(supabaseAdmin,data.user.id,'moderation');if(limited)return limited
    const body=await req.json().catch(()=>({}))
    if(!['room','post'].includes(body.targetType) || typeof body.targetId!=='string' ||
      !['privacy','copyright','harassment','inappropriate','other'].includes(body.reason) ||
      typeof body.hidden!=='boolean' || typeof body.requestId!=='string')
      return NextResponse.json({error:'入力内容を確認してください'}, {status:400})
    const {error:actionError}=await supabaseAdmin.rpc('mvp_moderate',{p_actor:data.user.id,p_type:body.targetType,
      p_target:body.targetId,p_reason:body.reason,p_hidden:body.hidden,p_request:body.requestId})
    if(actionError) return NextResponse.json({error:'権限または対象の状態を確認してください'}, {status:409})
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}})
  } catch {return NextResponse.json({error:'処理できませんでした'}, {status:503})}
}
