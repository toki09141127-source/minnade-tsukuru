import {createHash} from 'node:crypto'
import {NextResponse} from 'next/server'
import {supabaseAdmin} from '@/lib/supabase/admin'
import {piiSignals} from '@/lib/publicationSafety'
export async function POST(req:Request) {
 try{
  const auth=req.headers.get('authorization')??''
  if(!auth.startsWith('Bearer '))return NextResponse.json({error:'ログインしてください'},{status:401})
  const {data,error}=await supabaseAdmin.auth.getUser(auth.slice(7))
  if(error||!data.user)return NextResponse.json({error:'ログインしてください'},{status:401})
  if(process.env.MVP_DRAFTS_ENABLED!=='true')return NextResponse.json({error:'公開確認は準備中です'},{status:503})
  const body=await req.json().catch(()=>({}))
  if(typeof body.postId!=='string'||typeof body.roomId!=='string'||typeof body.approved!=='boolean'||body.confirm!==true)
   return NextResponse.json({error:'確認内容を指定してください'},{status:400})
  // Do not read a nonmember's private content even when the privileged RPC will reject later.
  const {data:member,error:memberError}=await supabaseAdmin.from('room_members').select('role,left_at').eq('room_id',body.roomId).eq('user_id',data.user.id).maybeSingle()
  if(memberError)return NextResponse.json({error:'確認できませんでした'},{status:503})
  if(!member||member.left_at||!['creator','core'].includes(member.role))return NextResponse.json({error:'操作できません'},{status:403})
  const {data:post,error:postError}=await supabaseAdmin.from('posts').select('content,attachment_url,attachment_type').eq('id',body.postId).eq('room_id',body.roomId).eq('is_hidden',false).is('deleted_at',null).maybeSingle()
  if(postError||!post)return NextResponse.json({error:'投稿が見つかりません'},{status:404})
  if(body.approved&&piiSignals(post.content??'').length)return NextResponse.json({error:'個人情報の可能性があるため公開できません'},{status:400})
  const {error:reviewError}=await supabaseAdmin.rpc('mvp_review_log',{p_actor:data.user.id,p_room:body.roomId,p_post:body.postId,
   p_public:body.approved,p_hash:createHash('sha256').update([post.content,post.attachment_url,post.attachment_type].map(value=>{const text=value??'';return Buffer.byteLength(text,'utf8')+':'+text}).join(''),'utf8').digest('hex')})
  if(reviewError)return NextResponse.json({error:'期限・権限・本文の変更を確認してください'},{status:409})
  return NextResponse.json({ok:true})
 }catch{return NextResponse.json({error:'確認を保存できませんでした'},{status:503})}
}
