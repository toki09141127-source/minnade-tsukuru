/* eslint-disable @typescript-eslint/no-require-imports */
// Only dedicated synthetic staging. Operator pause uses the owner-only Dashboard; no secret in signals.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const {createClient}=require('@supabase/supabase-js'),{load}=require('./safety.cjs');
const moduleFor=(root,name)=>{const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports,require:n=>moduleFor(root,n.replace('./',''))});return mod.exports;};
(async()=>{
 const c=load(),admin=createClient(c.url,c.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {resumeAccountDeletion}=moduleFor(c.root,'accountDeletion'),{createAccountDeletionPorts}=moduleFor(c.root,'accountDeletionAdapter'),{createFinalDeletionPreparation}=moduleFor(c.root,'accountDeletionPreparation');
 const run=crypto.randomUUID(),r={runId:run,projectRef:c.ref,checks:[],complete:false},signal=path.join(c.root,'.staging-private/pause-signal.json');
 const save=()=>fs.writeFileSync('docs/deletion-pause-staging-result.json',JSON.stringify(r,null,2));
 const ok=(v,name)=>{assert.ok(v,name);r.checks.push({name,status:'PASS'});save();console.log('PASS '+name)};
 const rpc=async(n,a)=>{const x=await admin.rpc(n,a);if(x.error)throw Error('RPC_'+n+'_'+(/^[A-Z_]+$/.test(x.error.message)?x.error.message:x.error.code));return x.data};
 const barrier=async(phase,paused)=>{r.waiting={phase,paused};save();console.log('WAIT '+phase+' paused='+paused);const until=Date.now()+600000;while(Date.now()<until){let s;try{s=JSON.parse(fs.readFileSync(signal,'utf8'))}catch{}if(s?.runId===run&&s?.phase===phase){assert.equal(await rpc('mvp_deletion_is_paused',{}),paused);delete r.waiting;save();return}await new Promise(resolve=>setTimeout(resolve,500))}throw Error('OPERATOR_SIGNAL_TIMEOUT')};
 const request=actor=>({p_actor:actor,p_attribution:'anonymous',p_policy:'withdrawal-draft-2026-10-21'});
 const worker=(job,client=admin)=>resumeAccountDeletion(job,createAccountDeletionPorts(client,createFinalDeletionPreparation(client)));
 try{
  const ids=[];for(const alias of ['owner','B','C','D','F']){const x=await admin.auth.admin.createUser({email:'pause-'+alias+'-'+run+'@example.invalid',password:crypto.randomBytes(32).toString('base64url'),email_confirm:true,user_metadata:{synthetic:true,test_run:run}});assert.ok(!x.error&&x.data.user,'SEED');ids.push(x.data.user.id)}
  ok((await admin.rpc('mvp_request_deletion',request(ids[1]))).error?.message==='DELETION_PAUSED','A paused intake rejected');
  ok(!!(await admin.rpc('mvp_set_deletion_pause',{p_paused:false})).error,'Service role cannot operate pause');
  await barrier('start',false);
  const room=await rpc('mvp_create_room',{p_actor:ids[0],p_request:crypto.randomUUID(),p_settings:{title:'SYNTHETIC PAUSE '+run.slice(0,8),category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'}});
  for(let i=1;i<ids.length;i++)await rpc('mvp_join_member',{p_actor:ids[i],p_room:room,p_terms:'2026-03-24'});
  for(const [i,label] of [[1,'B'],[2,'C'],[3,'D']]){
   const actor=ids[i],items=[];
   for(const used of [true,false]){const id=crypto.randomUUID(),p='rooms/'+room+'/files/'+id+'.txt';assert.ok(!(await admin.from('attachment_uploads').insert({id,user_id:actor,room_id:room,storage_path:p,status:'reserved',mime_type:'text/plain',size_bytes:20})).error);assert.ok(!(await admin.storage.from('room_uploads').upload(p,Buffer.from('SYNTHETIC PAUSE'),{contentType:'text/plain'})).error);assert.ok(!(await admin.from('attachment_uploads').update({status:'uploaded',uploaded_at:new Date().toISOString()}).eq('id',id)).error);items.push({id,path:p});if(used)await rpc('create_post_with_upload',{p_actor:actor,p_room:room,p_content:'SYNTHETIC KEEP '+label,p_post_type:'log',p_upload:id,p_request_key:crypto.randomUUID()});}
   const job=await rpc('mvp_request_deletion',request(actor));let intercepted=false,deletes=0,removes=0;
   const client={rpc:async(n,a)=>{const match=label==='B'?n==='mvp_deletion_checkpoint'&&a.p_phase==='after_prepare':n==='mvp_begin_deletion_effect'&&a.p_effect===(label==='C'?'storage_delete':'auth_delete');if(match&&!intercepted){intercepted=true;await barrier(label+'-pause',true)}return admin.rpc(n,a)},storage:{from:b=>({remove:async p=>{removes++;return admin.storage.from(b).remove(p)}})},auth:{admin:{getUserById:admin.auth.admin.getUserById.bind(admin.auth.admin),deleteUser:async(...a)=>{deletes++;return admin.auth.admin.deleteUser(...a)}}}};
   ok(await worker(job,client)==='paused',label+' worker acknowledges pause');
   const state=await admin.from('account_deletion_jobs').select('stage').eq('id',job).single();ok(!state.error&&state.data.stage===(label==='D'?'auth_unknown':'requested'),label+' durable state remains resumable');
   ok(deletes===0&&!!(await admin.auth.admin.getUserById(actor)).data.user,label+' Auth preserved before delete');
   if(label!=='D')ok(removes===0&&!(await admin.storage.from('room_uploads').download(items[1].path)).error,label+' unused object survives pre-Storage pause');
   ok(await worker(job)==='paused',label+' paused retry cannot claim');
   await barrier(label+'-resume',false);
   ok(await worker(job)==='completed',label+' E resume completes');
   ok(!(await admin.storage.from('room_uploads').download(items[0].path)).error,label+' used object retained');
   ok(!!(await admin.storage.from('room_uploads').download(items[1].path)).error,label+' unused object removed after resume');
   ok((await admin.auth.admin.getUserById(actor)).error?.code==='user_not_found',label+' Auth explicitly absent after completion');
  }
  const job=await rpc('mvp_request_deletion',request(ids[4]));let deletes=0;
  const client={rpc:admin.rpc.bind(admin),storage:admin.storage,auth:{admin:{getUserById:admin.auth.admin.getUserById.bind(admin.auth.admin),deleteUser:async(...a)=>{deletes++;return admin.auth.admin.deleteUser(...a)}}}};
  const states=await Promise.all([worker(job,client),worker(job,client)]);
  ok(states.includes('completed')&&states.includes('busy')&&deletes===1,'F simultaneous workers perform one Auth deletion');
  await barrier('finish',true);r.complete=true;save();console.log('STAGING_PAUSE_COMPLETE');
 }catch(e){r.failure={code:/^[A-Za-z0-9_]+$/.test(e.message)?e.message:'ASSERTION_FAILED',assertion:e.name==='AssertionError'?e.message:undefined};save();console.error('STAGING_PAUSE_FAILED');process.exitCode=1}
})().catch(()=>{console.error('STAGING_PAUSE_SETUP_FAILED');process.exitCode=1});
