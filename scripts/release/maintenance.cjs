/* eslint-disable @typescript-eslint/no-require-imports */
// HTTP maintenance rehearsal. Real staging only, local app, synthetic fixtures only.
const fs=require('node:fs'),net=require('node:net'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {load}=require('../staging/safety.cjs'),{createClient}=require('@supabase/supabase-js');
(async()=>{
 const c=load(),f=JSON.parse(fs.readFileSync('.staging-private/release-staging-fixture.json')),prior=JSON.parse(fs.readFileSync('docs/release-staging-result.json'));
 assert.equal(prior.projectRef,c.ref);assert.equal(f.runId,prior.runId);assert.ok(prior.complete);
 const u=f.credentials.find(x=>x.alias==='creator');assert.ok(u.email.endsWith('@example.invalid'));
 const opts={auth:{persistSession:false,autoRefreshToken:false}},auth=createClient(c.url,c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts),admin=createClient(c.url,c.env.SUPABASE_SERVICE_ROLE_KEY,opts);
 const login=await auth.auth.signInWithPassword({email:u.email,password:u.password});assert.ok(!login.error&&login.data.user.id===u.id,'SYNTHETIC_LOGIN');const token=login.data.session.access_token;
 const r={runId:crypto.randomUUID(),projectRef:c.ref,scope:'Local HTTP app backed by real staging; synthetic fixtures; NOT all connections maintenance',checks:[],complete:false};
 const save=()=>fs.writeFileSync('docs/release52-maintenance-result.json',JSON.stringify(r,null,2)+'\n');
 const ok=(v,name)=>{assert.ok(v,name);r.checks.push({name,pass:true});save();console.log('PASS '+name)};
 const flags=['DB_GUARDS','UPLOADS','ROOM_CREATION','ATOMIC_JOIN','ATOMIC_CORE','MEMBERSHIP_GUARDS','LIKE_REQUESTS','REPORT_INTAKE','REPORT_QUEUE','MODERATION','DRAFTS','ACCOUNT_ATTRIBUTION','ACCOUNT_REQUESTS','ACCOUNT_FINALIZE'];
 const cron=crypto.randomBytes(32).toString('hex');let server,log;
 async function stop(){if(server){server.kill();await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,5000)});server=null}if(log!==undefined){fs.closeSync(log);log=undefined}}
 async function start(on){
  const s=net.createServer();await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));const port=s.address().port;await new Promise(resolve=>s.close(resolve));
  const flagEnv=Object.fromEntries(flags.map(x=>['MVP_'+x+'_ENABLED',String(on)]));
  // DB pause is kept true throughout; even enabled deletion entry points cannot execute deletion.
  log=fs.openSync('.staging-private/release52-maintenance-'+(on?'on':'off')+'.log','w');
  server=spawn(process.execPath,['--require','./scripts/staging/web-network.cjs','node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p',String(port)],{cwd:c.root,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,...c.env,...flagEnv,NODE_OPTIONS:'',SUPABASE_URL:c.url,CRON_SECRET:cron,NEXT_TELEMETRY_DISABLED:'1'}});
  const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error('SERVER_EXITED');try{if((await fetch(base+'/api/account/delete',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,500))}assert.ok(ready,'SERVER_NOT_READY');return base;
 }
 async function call(base,route,body,method='POST',secret=false){const x=await fetch(base+route,{method,headers:{authorization:'Bearer '+(secret?cron:token),...(body instanceof FormData?{}:{'content-type':'application/json'})},body:method==='GET'?undefined:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const json=await x.json();return {status:x.status,json};}
 async function counts(){const out=[];for(const [t,k,v]of [['rooms','created_by',u.id],['posts','room_id',prior.roomId],['attachment_uploads','room_id',prior.roomId],['account_deletion_jobs','actor_id',u.id]]){const x=await admin.from(t).select('*',{count:'exact',head:true}).eq(k,v);assert.ok(!x.error,'COUNT_FAILED_'+t);out.push(x.count)}return out}
 try{
  const paused=await admin.rpc('mvp_deletion_is_paused');ok(!paused.error&&paused.data===true,'Staging DB deletion pause is true before rehearsal');
  const before=await counts(),requestId=crypto.randomUUID();let base=await start(false);
  ok((await call(base,'/api/rooms/create',{title:'TEST maintenance '+r.runId,requestId})).status===503,'Room creation OFF returns 503');
  ok((await call(base,'/api/posts/create',{roomId:prior.roomId,content:'TEST stopped post',requestId:crypto.randomUUID()})).status===503,'Post OFF returns 503');
  ok((await call(base,'/api/uploads',{})).status===503,'Upload OFF returns 503');
  ok((await call(base,'/api/account/delete',{confirm:true,attribution:'anonymous',policyVersion:'withdrawal-draft-2026-10-21'})).status===503,'Deletion intake OFF returns 503');
  ok((await call(base,'/api/cron/account-deletion',{requestId:crypto.randomUUID()},'POST',true)).status===503,'Deletion worker OFF returns 503');
  ok((await call(base,'/api/cron/publish',null,'GET',true)).status===503,'Forced publish OFF returns 503 with valid secret');
  ok((await call(base,'/api/rooms/join',{roomId:prior.roomId})).status===410,'Legacy join stays closed');
  ok(JSON.stringify(await counts())===JSON.stringify(before),'OFF requests leave fixture row counts unchanged');
  await stop();base=await start(true);
  const create=await call(base,'/api/rooms/create',{title:'TEST maintenance resume',requestId,work_type:'novel',hours:24});ok(create.status===200&&!!create.json.room?.id,'Room creation resumes');const roomId=create.json.room.id;r.roomId=roomId;
  const post=await call(base,'/api/posts/create',{roomId,content:'TEST maintenance resume',requestId:crypto.randomUUID()});ok(post.status===200&&!!post.json.postId,'Post resumes');
  const png=await require('sharp')({create:{width:8,height:8,channels:3,background:{r:20,g:100,b:80}}}).png().toBuffer(),form=new FormData();form.set('roomId',roomId);form.set('file',new Blob([png],{type:'image/png'}),'test-maintenance.png');const upload=await call(base,'/api/uploads',form);ok(upload.status===200&&!!upload.json.uploadId,'Upload resumes with ledger');
  const attached=await call(base,'/api/posts/create',{roomId,content:'TEST maintenance attachment',uploadId:upload.json.uploadId,requestId:crypto.randomUUID()});ok(attached.status===200,'Uploaded TEST object attaches atomically after resume');
  const publish=await call(base,'/api/cron/publish',null,'GET',true);ok(publish.status===200&&publish.json.ok,'Forced publish resumes on synthetic staging');
  const intake=await call(base,'/api/account/delete',{confirm:true,attribution:'anonymous',policyVersion:'withdrawal-draft-2026-10-21'});ok(intake.status===503,'Enabled deletion intake remains blocked by DB pause');
  ok((await admin.rpc('mvp_deletion_is_paused')).data===true,'DB pause remains true at end');
  const previous=JSON.parse(fs.readFileSync('docs/deletion-pause-staging-result.json'));r.reusedDeletionEvidence={file:'deletion-pause-staging-result.json',checks:previous.checks.length,complete:previous.complete};
  r.complete=true;
 }catch(e){r.failure=/^[A-Z0-9_]+$/.test(e.message||'')?e.message:'MAINTENANCE_ASSERTION_FAILED';process.exitCode=1}
 finally{await stop();await auth.auth.signOut({scope:'local'});r.localServersStopped=true;save();console.log(JSON.stringify(r))}
})().catch(()=>{console.error('MAINTENANCE_SETUP_FAILED');process.exitCode=1});
