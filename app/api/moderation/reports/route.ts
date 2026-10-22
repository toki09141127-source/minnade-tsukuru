import { limitAction } from '@/lib/apiGuards'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
const headers={'Cache-Control':'no-store'}
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers})
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function actor(req:Request){
 const auth=req.headers.get('authorization')??''
 if(!auth.startsWith('Bearer '))return null
 const {data,error}=await supabaseAdmin.auth.getUser(auth.slice(7))
 return error?null:data.user?.id??null
}
export async function GET(req:Request){
 try{
  const user=await actor(req);if(!user)return reply({error:'ログインしてください'},401)
  if(process.env.MVP_REPORT_QUEUE_ENABLED!=='true')return reply({error:'通報管理は準備中です'},503)
  const limited=await limitAction(supabaseAdmin,user,'moderation_read');if(limited)return limited
  const url=new URL(req.url),time=url.searchParams.get('afterTime'),id=url.searchParams.get('afterId')
  if((time===null)!==(id===null) || (id!==null&&(!uuid.test(id)||!time||!Number.isFinite(Date.parse(time)))))
   return reply({error:'一覧の位置を確認してください'},400)
  const {data,error}=await supabaseAdmin.rpc('mvp_pending_reports',{p_actor:user,p_after_time:time,p_after_id:id})
  if(error||!data||!Array.isArray(data.items))return reply({error:'権限または状態を確認してください'},403)
  const items=data.items.slice(0,50),last=items.at(-1)
  return reply({...data,items,next:data.items.length>50&&last?{afterTime:last.created_at,afterId:last.id}:null})
 }catch{return reply({error:'一覧を確認できませんでした'},503)}
}
export async function POST(req:Request){
 try{
  const user=await actor(req);if(!user)return reply({error:'ログインしてください'},401)
  if(process.env.MVP_REPORT_QUEUE_ENABLED!=='true')return reply({error:'通報管理は準備中です'},503)
  const limited=await limitAction(supabaseAdmin,user,'moderation');if(limited)return limited
  const b=await req.json().catch(()=>({}))
  if(!uuid.test(b.receiptId??'')||!uuid.test(b.requestId??'')||!['hidden','no_action'].includes(b.outcome)||
   typeof b.note!=='string'||!b.note.trim()||b.note.trim().length>1000||b.confirm!==true)
   return reply({error:'対象・対応理由・確認を入力してください'},400)
  const {error}=await supabaseAdmin.rpc('mvp_resolve_report',{p_actor:user,p_receipt:b.receiptId,p_request:b.requestId,p_outcome:b.outcome,p_note:b.note.trim()})
  if(error)return reply({error:'権限・対象・他の担当者の対応を確認してください。結果不明の場合は同じ内容で再試行できます。'},409)
  return reply({ok:true})
 }catch{return reply({error:'対応結果を確認できませんでした。同じ内容で再試行してください'},503)}
}
