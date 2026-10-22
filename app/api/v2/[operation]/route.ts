import { NextResponse } from 'next/server'
import { v2Client,v2Enabled } from '@/lib/v2/server'
import { departedAuthorLabels } from '@/lib/departedAuthorLabels'
import { ERRORS,GENRES,safeText,uuid,validBlocks } from '@/lib/v2/domain'
export const dynamic='force-dynamic'
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}})
const failure=(message:string)=>reply({error:ERRORS[message]??'内容・権限・期限を確認してください。',code:message in ERRORS?message:'REQUEST_FAILED'},['FORBIDDEN','NOT_CREATOR','MEMBER_REQUIRED','MEMBER_EXCLUDED'].includes(message)?403:message==='RATE_LIMITED'?429:409)
export async function GET(req:Request,{params}:{params:Promise<{operation:string}>}){
 if(!v2Enabled())return reply({error:'この機能は利用できません。'},503)
 try{
  const {operation}=await params,u=new URL(req.url),id=u.searchParams.get('roomId');if(!uuid(id))return reply({error:'ルームを確認してください。'},400)
  const client=v2Client(req)
  if(operation==='state'){const r=await client.rpc('v2_room_state',{p_room:id});return r.error?failure(r.error.message):reply(r.data)}
  if(operation==='log'){
   const query=u.searchParams.get('q')??'',filter=u.searchParams.get('filter')??'all',after=u.searchParams.get('after'),afterId=u.searchParams.get('afterId')
   if(query.length>100||!['all','highlight','image','mine'].includes(filter)||(after!==null&&(!Number.isFinite(Date.parse(after))||!uuid(afterId))))return reply({error:'検索条件を確認してください。'},400)
   const r=await client.rpc('v2_log',{p_room:id,p_query:query,p_filter:filter,p_after:after,p_after_id:afterId,p_limit:31})
   if(r.error)return failure(r.error.message)
   const rows=r.data??[],labels=await departedAuthorLabels(client,rows.map((row:{user_id:string})=>row.user_id));return reply({posts:rows.slice(0,30).map((row:{user_id:string;username:string|null})=>({...row,username:labels.get(row.user_id)??row.username})),hasMore:rows.length>30})
  }
  if(operation==='work'){const r=await client.from('v2_work_snapshots').select('room_id,title,description,genre,blocks,incomplete,published_at,highlight_post_ids').eq('room_id',id).maybeSingle();return r.error?reply({error:'作品を読み込めませんでした。'},503):r.data?reply(r.data):reply({error:'作品が見つかりません。'},404)}
  return reply({error:'操作が見つかりません。'},404)
 }catch{return reply({error:'読み込めませんでした。'},503)}
}
export async function POST(req:Request,{params}:{params:Promise<{operation:string}>}){
 if(!v2Enabled())return reply({error:'この機能は利用できません。'},503)
 try{
  if(!req.headers.get('authorization')?.startsWith('Bearer '))return reply({error:'ログインしてください。'},401)
  const client=v2Client(req),{data,error}=await client.auth.getUser();if(error||!data.user)return reply({error:'ログインしてください。'},401)
  const raw=await req.text();if(raw.length>300000)return reply({error:'内容が大きすぎます。'},413)
  let b;try{b=JSON.parse(raw)}catch{return reply({error:'内容を確認してください。'},400)}
  const {operation}=await params;let name:string,args:Record<string,unknown>
  if(operation==='create'){
   if(!uuid(b.requestId)||!safeText(b.title,120)||!b.title.trim()||!safeText(b.description,300)||[...b.description.trim()].length<20||!(b.genre in GENRES)||!Number.isInteger(b.capacity)||b.capacity<2||b.capacity>50||!['forbidden','assist','free'].includes(b.aiLevel)||!Number.isFinite(Date.parse(b.deadline))||b.consent!==true)return reply({error:'タイトル・説明・ジャンル・定員・締切・同意を確認してください。'},400)
   name='v2_create_room';args={p_request:b.requestId,p_title:b.title,p_description:b.description,p_genre:b.genre,p_deadline:b.deadline,p_capacity:b.capacity,p_ai:b.aiLevel,p_consent:b.consent===true?'2026-10-22-v2.1':null}
  }else{
   if(!uuid(b.roomId))return reply({error:'ルームを確認してください。'},400)
   if(operation==='member'){
    if(!['join','leave','apply_core','approve_core','reject_core','kick','demote','resign_core','approve_resignation'].includes(b.action)||(b.target!=null&&!uuid(b.target))||(b.requestId!=null&&!uuid(b.requestId)))return reply({error:'操作を確認してください。'},400)
    name='v2_member_action';args={p_room:b.roomId,p_action:b.action,p_target:b.target??null,p_request:b.requestId??null,p_consent:b.consent??null}
   }else if(operation==='post'){
    if(!uuid(b.postId)||!['highlight','exclude','include','approve_public'].includes(b.action)||(b.action==='highlight'&&typeof b.expected!=='boolean')||(b.action==='approve_public'&&b.reviewed!==true))return reply({error:'投稿と公開確認を指定してください。'},400)
    name='v2_post_action';args={p_room:b.roomId,p_post:b.postId,p_action:b.action,p_expected:b.expected??null}
   }else if(operation==='draft'){
    if(!Number.isInteger(b.version)||b.version<0||b.reviewed!==true||!validBlocks(b.blocks))return reply({error:'ブロックの内容・画像・個人情報・公開確認を見直してください。'},400)
    name='v2_save_draft';args={p_room:b.roomId,p_version:b.version,p_blocks:b.blocks,p_reviewed:true}
   }else return reply({error:'操作が見つかりません。'},404)
  }
  const result=await client.rpc(name,args);return result.error?failure(result.error.message):reply({ok:true,data:result.data})
 }catch{return reply({error:'処理結果を確認できませんでした。再読み込みで状態を確認してください。'},503)}
}
