/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),crypto=require('node:crypto'),{createClient}=require('@supabase/supabase-js'),{load}=require('../staging/safety.cjs');
(async()=>{
 const ctx=load(),f=JSON.parse(fs.readFileSync('.staging-private/release-staging-fixture.json')),m=JSON.parse(fs.readFileSync('docs/release52-maintenance-result.json'));if(m.projectRef!==ctx.ref||!m.complete)throw Error('STAGING_FIXTURE_REQUIRED');
 const u=f.credentials.find(x=>x.alias==='creator');if(!u.email.endsWith('@example.invalid'))throw Error('SYNTHETIC_REQUIRED');
 const opt={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(ctx.url,ctx.env.SUPABASE_SERVICE_ROLE_KEY,opt),client=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opt);
 const r={projectRef:ctx.ref,scope:'Real staging service-role and Auth/Storage stop probe; synthetic only',checks:[],complete:false};
 const ok=(v,name)=>{if(!v)throw Error(name);r.checks.push({name,pass:true});console.log('PASS '+name)};
 try{
  const change=await admin.from('rooms').update({title:'TEST MUST BE BLOCKED'}).eq('id',m.roomId);ok(change.error?.message==='MVP_RELEASE_MAINTENANCE','DIRECT_SERVICE_WRITE_BLOCKED');
  const rpc=await admin.rpc('create_post_with_upload',{p_actor:u.id,p_room:m.roomId,p_request_key:crypto.randomUUID(),p_upload:null,p_content:'TEST MUST BE BLOCKED',p_post_type:'log'});ok(rpc.error?.message==='MVP_RELEASE_MAINTENANCE','SECURITY_DEFINER_RPC_WRITE_BLOCKED');
  const login=await client.auth.signInWithPassword({email:u.email,password:u.password});ok(!!login.error,'AUTH_LOGIN_STATE_WRITE_BLOCKED');
  const create=await admin.auth.admin.createUser({email:'stopped-'+crypto.randomUUID()+'@example.invalid',password:crypto.randomBytes(32).toString('hex'),email_confirm:true});ok(!!create.error&&!create.data.user,'AUTH_USER_CREATION_BLOCKED');
  const ledger=await admin.from('attachment_uploads').select('storage_path,bucket,mime_type').eq('room_id',m.roomId).eq('user_id',u.id).eq('status','bound').single();if(ledger.error)throw Error('SYNTHETIC_LEDGER_REQUIRED');
  const o=ledger.data,before=await admin.storage.from(o.bucket).download(o.storage_path);if(before.error)throw Error('SYNTHETIC_READ_REQUIRED');const a=Buffer.from(await before.data.arrayBuffer());
  const removed=await admin.storage.from(o.bucket).remove([o.storage_path]);ok(!!removed.error,'STORAGE_DELETE_BLOCKED');
  const after=await admin.storage.from(o.bucket).download(o.storage_path);if(after.error)throw Error('STORAGE_EXISTING_OBJECT_LOST');const b=Buffer.from(await after.data.arrayBuffer());ok(crypto.createHash('sha256').update(a).digest('hex')===crypto.createHash('sha256').update(b).digest('hex'),'BLOCKED_DELETE_PRESERVES_OBJECT_BYTES');
  const upload=await admin.storage.from(o.bucket).upload('rooms/'+m.roomId+'/images/'+crypto.randomUUID()+'.png',a,{contentType:o.mime_type,upsert:false});ok(!!upload.error,'STORAGE_UPLOAD_BLOCKED');
  ok((await admin.rpc('mvp_deletion_is_paused')).data===true,'DELETION_PAUSE_REMAINS_TRUE');r.complete=true;
 }catch(e){r.failure=/^[A-Z0-9_]+$/.test(e.message||'')?e.message:'STOP_PROBE_FAILED';process.exitCode=1}
 finally{fs.writeFileSync('docs/release52-global-stop-result.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r))}
})().catch(()=>{console.error('STOP_PROBE_SETUP_FAILED');process.exitCode=1});
