import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { limitAction } from '@/lib/apiGuards'
export async function POST(req: Request) {
  try {
    const auth=req.headers.get('authorization') ?? ''
    if (!auth.startsWith('Bearer ')) return NextResponse.json({error:'ログインしてください'}, {status:401})
    const {data,error}=await supabaseAdmin.auth.getUser(auth.slice(7))
    if(error || !data.user) return NextResponse.json({error:'ログインしてください'}, {status:401})
    if(process.env.MVP_MEMBERSHIP_GUARDS_ENABLED!=='true')
      return NextResponse.json({error:'メンバー管理は準備中です'}, {status:503})
    const body=await req.json().catch(()=>({}))
    if(!['kick','demote'].includes(body.action) || typeof body.roomId!=='string' || typeof body.targetUserId!=='string')
      return NextResponse.json({error:'操作対象を確認してください'}, {status:400})
    const limited=await limitAction(supabaseAdmin,data.user.id,'core')
    if(limited) return limited
    const {error:rpcError}=await supabaseAdmin.rpc('mvp_manage_member',{
      p_actor:data.user.id,p_room:body.roomId,p_target:body.targetUserId,p_action:body.action,
    })
    if(rpcError) return NextResponse.json({error:'権限または参加状態を確認してください'}, {status:409})
    return NextResponse.json({ok:true})
  } catch { return NextResponse.json({error:'操作できませんでした'}, {status:503}) }
}

export async function GET(req: Request) {
  try {
    const auth=req.headers.get('authorization') ?? ''
    if(!auth.startsWith('Bearer ')) return NextResponse.json({error:'ログインしてください'}, {status:401})
    const {data,error}=await supabaseAdmin.auth.getUser(auth.slice(7))
    if(error || !data.user) return NextResponse.json({error:'ログインしてください'}, {status:401})
    if(process.env.MVP_MEMBERSHIP_GUARDS_ENABLED!=='true') return NextResponse.json({enabled:false,members:[]}, {headers:{'Cache-Control':'no-store'}})
    const roomId=new URL(req.url).searchParams.get('roomId')
    const {data:room,error:roomError}=await supabaseAdmin.from('rooms').select('created_by,status,is_hidden,deleted_at').eq('id',roomId).maybeSingle()
    if(roomError) return NextResponse.json({error:'確認できませんでした'}, {status:503})
    if(!room || room.created_by!==data.user.id || room.status!=='open' || room.is_hidden!==false || room.deleted_at)
      return NextResponse.json({error:'操作できません'}, {status:403})
    const {data:members,error:memberError}=await supabaseAdmin.from('room_members').select('user_id,username,role')
      .eq('room_id',roomId).is('left_at',null).in('role',['core','supporter'])
    if(memberError) return NextResponse.json({error:'確認できませんでした'}, {status:503})
    return NextResponse.json({enabled:true,members}, {headers:{'Cache-Control':'no-store'}})
  } catch {return NextResponse.json({error:'確認できませんでした'}, {status:503})}
}
