import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { piiSignals } from '@/lib/publicationSafety'
async function actor(req:Request) {
  const auth=req.headers.get('authorization') ?? ''
  if(!auth.startsWith('Bearer ')) return null
  const {data,error}=await supabaseAdmin.auth.getUser(auth.slice(7))
  return error ? null : data.user
}
export async function POST(req:Request) {
  try {
    const user=await actor(req)
    if(!user) return NextResponse.json({error:'ログインしてください'}, {status:401})
    if(process.env.MVP_DRAFTS_ENABLED!=='true') return NextResponse.json({error:'ドラフト機能は準備中です'}, {status:503})
    const body=await req.json().catch(()=>({}))
    if(typeof body.roomId!=='string' || !Number.isInteger(body.version) || body.version<0 ||
      body.reviewed!==true || !Array.isArray(body.blocks) || body.blocks.length>50 ||
      body.blocks.some((block:unknown)=>{
        if(!block || typeof block!=='object') return true
        const b=block as Record<string,unknown>
        return typeof b.id!=='string' || b.id.length>64 || !['title','summary','text','notes'].includes(String(b.kind)) ||
          typeof b.text!=='string' || b.text.length>20000 || piiSignals(b.text).length>0
      })) return NextResponse.json({error:'内容・個人情報・公開前の確認を見直してください'}, {status:400})
    const {data:version,error}=await supabaseAdmin.rpc('mvp_save_draft',{
      p_actor:user.id,p_room:body.roomId,p_version:body.version,p_blocks:body.blocks.map((b:{id:string;kind:string;text:string})=>({id:b.id,kind:b.kind,text:b.text})),
    })
    if(error) return NextResponse.json({error:'権限・期限・他の編集を確認してください。入力は保存されていません。'}, {status:409})
    return NextResponse.json({ok:true,version})
  } catch {return NextResponse.json({error:'保存できませんでした'}, {status:503})}
}
export async function GET(req:Request) {
  try {
    const user=await actor(req)
    if(!user) return NextResponse.json({error:'ログインしてください'}, {status:401})
    if(process.env.MVP_DRAFTS_ENABLED!=='true') return NextResponse.json({enabled:false},{headers:{'Cache-Control':'no-store'}})
    const roomId=new URL(req.url).searchParams.get('roomId')
    const {data:room,error:roomError}=await supabaseAdmin.from('rooms').select('status,is_hidden,deleted_at').eq('id',roomId).maybeSingle()
    const {data:member,error:memberError}=await supabaseAdmin.from('room_members').select('role,left_at').eq('room_id',roomId).eq('user_id',user.id).maybeSingle()
    if(roomError || memberError) return NextResponse.json({error:'確認できませんでした'}, {status:503})
    if(!room || room.is_hidden!==false || room.deleted_at || !member || member.left_at || !['creator','core'].includes(member.role))
      return NextResponse.json({error:'操作できません'}, {status:403})
    const {data:draft,error}=await supabaseAdmin.from('work_drafts').select('blocks,version,published_at').eq('room_id',roomId).maybeSingle()
    if(error) return NextResponse.json({error:'読み込めませんでした'}, {status:503})
    return NextResponse.json({enabled:true,draft:draft ?? {blocks:[],version:0,published_at:null}},{headers:{'Cache-Control':'no-store'}})
  } catch{return NextResponse.json({error:'読み込めませんでした'}, {status:503})}
}
