/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const {createClient}=require('@supabase/supabase-js'),{load}=require('./safety.cjs');
const moduleFor=(root,name)=>{const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports,require:n=>moduleFor(root,n.replace('./',''))});return mod.exports;};
(async()=>{
 const c=load(),opts={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(c.url,c.env.SUPABASE_SERVICE_ROLE_KEY,opts);
 const {resumeAccountDeletion}=moduleFor(c.root,'accountDeletion'),{createAccountDeletionPorts}=moduleFor(c.root,'accountDeletionAdapter'),{createFinalDeletionPreparation}=moduleFor(c.root,'accountDeletionPreparation');
 const run=crypto.randomUUID(),creds=[],r={runId:run,projectRef:c.ref,checks:[],complete:false},privatePath=path.join(c.root,'.staging-private',run+'.json');
 const save=()=>{fs.writeFileSync(privatePath,JSON.stringify({runId:run,projectRef:c.ref,credentials:creds}));fs.writeFileSync(path.join(c.root,'docs/deletion-final-staging-result.json'),JSON.stringify(r,null,2));};
 const ok=(v,name)=>{assert.ok(v,name);r.checks.push({name,status:'PASS'});save();console.log('PASS '+name)};
 const rpc=async(name,args)=>{const x=await admin.rpc(name,args);if(x.error){r.failure={operation:name,code:x.error.code,message:/^[A-Z_]+$/.test(x.error.message)?x.error.message:undefined};throw Error('RPC_FAILURE')}return x.data};
 let phase='seed';
 try{
  for(const alias of ['creator','member','core','other']){
   const email='delete-'+alias+'-'+run+'@example.invalid',password=crypto.randomBytes(32).toString('base64url');
   const x=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{synthetic:true,test_run:run}});
   assert.ok(!x.error&&x.data.user,'AUTH_SEED');creds.push({alias,id:x.data.user.id,email,password});save();
  }
  const [owner,member,core,other]=creds.map(x=>x.id);
  const room=await rpc('mvp_create_room',{p_actor:owner,p_request:crypto.randomUUID(),p_settings:{title:'SYNTHETIC DELETION '+run.slice(0,8),category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'}});r.room=room;save();
  for(const id of [member,core,other])await rpc('mvp_join_member',{p_actor:id,p_room:room,p_terms:'2026-03-24'});
  const request=id=>({p_actor:id,p_attribution:'anonymous',p_policy:'withdrawal-draft-2026-10-21'});
  const coreRequest=await rpc('mvp_request_core',{p_actor:core,p_room:room,p_terms:'2026-03-24'});
  await rpc('mvp_decide_core',{p_actor:owner,p_room:room,p_request:coreRequest,p_approve:true});
  ok((await admin.rpc('mvp_request_deletion',request(core))).error?.message==='ACTIVE_CORE_ROOMS','Active Core withdrawal denied');
  ok((await admin.rpc('mvp_request_deletion',request(owner))).error?.message==='UNPUBLISHED_CREATOR_ROOMS','Unpublished Creator withdrawal denied');
  const logged=createClient(c.url,c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts);
  const signed=await logged.auth.signInWithPassword({email:creds[1].email,password:creds[1].password});assert.ok(!signed.error);
  const staleSession=signed.data.session;
  phase='storage';
  const uploads=[];
  for(const label of ['used','unused']){
   const id=crypto.randomUUID(),storagePath='rooms/'+room+'/files/'+id+'.txt';
   const a=await admin.from('attachment_uploads').insert({id,user_id:member,room_id:room,storage_path:storagePath,status:'reserved',mime_type:'text/plain',size_bytes:20});
   assert.ok(!a.error,'UPLOAD_RESERVE');
   assert.ok(!(await admin.storage.from('room_uploads').upload(storagePath,Buffer.from('SYNTHETIC '+label),{contentType:'text/plain'})).error,'UPLOAD_OBJECT');
   assert.ok(!(await admin.from('attachment_uploads').update({status:'uploaded',uploaded_at:new Date().toISOString()}).eq('id',id)).error,'UPLOAD_MARK');
   uploads.push({id,path:storagePath,label});
  }
  const post=await rpc('create_post_with_upload',{p_actor:member,p_room:room,p_content:'SYNTHETIC RETAINED',p_post_type:'log',p_upload:uploads[0].id,p_request_key:crypto.randomUUID()});
  const foreign=await rpc('create_post_with_upload',{p_actor:other,p_room:room,p_content:'SYNTHETIC FOREIGN',p_post_type:'log',p_upload:null,p_request_key:crypto.randomUUID()});
  const foreignBefore=await admin.from('posts').select('*').eq('id',foreign).single();assert.ok(!foreignBefore.error);
  await rpc('mvp_set_room_like',{p_actor:member,p_room:room,p_expected:false,p_desired:true,p_request:crypto.randomUUID()});
  await rpc('mvp_receive_report',{p_actor:member,p_request:crypto.randomUUID(),p_type:'post',p_target:foreign,p_reason:'SYNTHETIC REPORT'});
  phase='member-request';
  const repeated=await Promise.all([1,2].map(()=>rpc('mvp_request_deletion',request(member))));
  ok(repeated[0]===repeated[1],'Concurrent duplicate request uses one job');const job=repeated[0];r.memberJob=job;save();
  ok(!!(await logged.rpc('mvp_prepare_deletion',{p_id:job,p_lease:crypto.randomUUID()})).error,'User cannot invoke worker prepare');
  const claim=(await rpc('mvp_claim_deletion',{p_id:job}))[0];assert.ok(claim);
  await rpc('mvp_prepare_deletion',{p_id:job,p_lease:claim.lease_token});
  await rpc('mvp_release_deletion',{p_id:job,p_lease:claim.lease_token});ok(true,'Process interruption after prepare leaves resumable durable state');
  let failStorage=true,failAuth=true,deleteCalls=0;
  const wrapped={rpc:admin.rpc.bind(admin),storage:{from:bucket=>({remove:async paths=>{
   if(failStorage){failStorage=false;return {error:{message:'synthetic transport failure'}}}return admin.storage.from(bucket).remove(paths);
  }})},auth:{admin:{getUserById:admin.auth.admin.getUserById.bind(admin.auth.admin),deleteUser:async(...args)=>{
   deleteCalls++;if(failAuth){failAuth=false;return {error:{message:'synthetic Auth failure'}}}return admin.auth.admin.deleteUser(...args);
  }}}};
  const runWorker=(id,client=admin)=>resumeAccountDeletion(id,createAccountDeletionPorts(client,createFinalDeletionPreparation(client)));
  phase='storage-failure';
  ok(await runWorker(job,wrapped)==='retry'&&deleteCalls===0,'Storage failure retries before any Auth deletion');
  ok(!!(await admin.auth.admin.getUserById(member)).data.user,'Auth remains after Storage failure');
  phase='auth-failure';
  ok(await runWorker(job,wrapped)==='retry'&&deleteCalls===1,'Auth deletion failure remains retryable');
  ok(!!(await admin.auth.admin.getUserById(member)).data.user,'Auth remains after injected Auth failure');
  phase='auth-delete';
  ok(await runWorker(job,wrapped)==='completed','Retry completes real Auth deletion');
  ok(await runWorker(job)==='completed','Completed deletion replay is idempotent');
  const absent=await admin.auth.admin.getUserById(member);ok(absent.error?.status===404&&absent.error?.code==='user_not_found','Auth absence verified explicitly');
  const keep=await admin.storage.from('room_uploads').download(uploads[0].path);ok(!keep.error&&(await keep.data.text())==='SYNTHETIC used','Used attachment retained after Auth deletion');
  const gone=await admin.storage.from('room_uploads').download(uploads[1].path);ok(!!gone.error,'Unused attachment removed through Storage SDK');
  ok(!!(await admin.storage.from('room_uploads').upload(uploads[1].path,Buffer.from('LATE'),{contentType:'text/plain'})).error,'Late upload registration rejected after completed deletion');
  const retained=await admin.from('posts').select('id,user_id,username,content').eq('id',post).single();
  ok(!retained.error&&retained.data.content==='SYNTHETIC RETAINED'&&retained.data.user_id!==member&&retained.data.username==='退会したメンバー','Post retained with anonymous non-Auth identity');
  const foreignAfter=await admin.from('posts').select('*').eq('id',foreign).single();ok(JSON.stringify(foreignBefore.data)===JSON.stringify(foreignAfter.data),'Other user post unchanged');
  const login=await logged.auth.signInWithPassword({email:creds[1].email,password:creds[1].password});ok(!!login.error,'Deleted user login rejected');
  ok(!!(await logged.auth.refreshSession({refresh_token:staleSession.refresh_token})).error,'Deleted user refresh rejected');
  const stale=createClient(c.url,c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{...opts,global:{headers:{Authorization:'Bearer '+staleSession.access_token}}});
  ok(!!(await stale.rpc('mvp_accept_current_terms',{p_terms:'2026-03-24',p_privacy:'2026-03-24'})).error,'Old JWT cannot write consent/profile');
  phase='core-demote';
  await rpc('mvp_manage_member',{p_actor:owner,p_room:room,p_target:core,p_action:'demote'});
  const coreJob=await rpc('mvp_request_deletion',request(core));ok(await runWorker(coreJob)==='completed','Core demoted to Member can complete withdrawal');
  phase='creator-publish';
  await rpc('mvp_save_draft',{p_actor:owner,p_room:room,p_version:0,p_blocks:[{id:'final',kind:'text',text:'SYNTHETIC SHARED WORK'}]});
  assert.ok(!(await admin.from('rooms').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',room)).error);
  await rpc('mvp_publish_due',{});
  const ownerJob=await rpc('mvp_request_deletion',request(owner));
  ok(await runWorker(ownerJob)==='completed','Published Creator withdrawal completes');
  const work=await admin.from('work_drafts').select('blocks,published_at').eq('room_id',room).single();
  ok(!work.error&&!!work.data.published_at&&work.data.blocks[0].text==='SYNTHETIC SHARED WORK','Shared published work survives Creator Auth deletion');
  await rpc('mvp_set_room_like',{p_actor:other,p_room:room,p_expected:false,p_desired:true,p_request:crypto.randomUUID()});ok(true,'Remaining member can like departed Creator work');
  r.complete=true;save();
 }catch(e){r.failure=r.failure||{phase,code:e.code||e.name,assertion:e.name==='AssertionError'?e.message:undefined};save();console.error('DELETION_STAGING_FAILED');process.exitCode=1;}
})().catch(()=>{console.error('DELETION_SETUP_FAILED');process.exitCode=1});

