/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),ts=require('typescript');
const at='2026-10-22T11:20:00Z', room='11111111-1111-4111-8111-111111111111';
let checks=0;
const ok=(v,n)=>{assert.ok(v,n);checks++;console.log('PASS '+n)};
function load(file,extras={}) {
 const m={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {module:m,exports:m.exports,Buffer,Response,Request,AbortSignal,Date:class extends Date {static now(){return Date.parse(at)}},
 process:{env:{}},require:n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts'),extras):require(n),...extras});
 return m.exports;
}
const {planPromotions,validateQueuedPromotion}=load('lib/buffer/promotionPlanner.ts');
const {createBufferSender}=load('lib/buffer/sender.ts');
const {runBuffer}=load('lib/buffer/worker.ts');
const candidate=(extra={})=>({id:'completed_'+room,kind:'completed',targetId:room,createdAt:'2026-10-22T00:00:00Z',
 expiresAt:'2026-10-29T00:00:00Z',snapshotAt:at,public:true,hidden:false,deleted:false,pendingReport:false,
 creatorExcluded:false,reviewed:true,piiClear:true,title:'共同制作の作品',...extra});
const p=planPromotions([candidate()],[],at)[0];
const channel={id:'6ad9a93b778b240e2f8816f0',name:'minnade_tsukuru',service:'twitter',isDisconnected:false,isLocked:false,isQueuePaused:false};
const reply=b=>new Response(JSON.stringify(b),{status:200});
const success=()=>reply({data:{createPost:{__typename:'PostActionSuccess',post:{id:'synthetic_post',dueAt:p.dueAt}}}});
const fixture=fs.readFileSync(path.join(__dirname,'buffer-queue-fixture.sql'),'utf8');
const migration=fs.readFileSync('supabase/migrations/202610220029_buffer_queue.sql','utf8').replaceAll('now()','public.buffer_test_now()');
async function main(){
 let calls=0;
 const sender=createBufferSender('synthetic-only',async(url,init)=>{
  calls++;assert.equal(url,'https://api.buffer.com');assert.equal(init.redirect,'error');
  const body=JSON.parse(init.body);
  if(body.query.startsWith('query'))return reply({data:{channel}});
  assert.equal(body.variables.input.mode,'customScheduled');assert.equal(body.variables.input.channelId,channel.id);
  return success();
 });
 ok(await sender.preflight(),'preflight channel identity');
 ok((await sender.send(p)).state==='succeeded'&&calls===2,'scheduled mutation minimum receipt');
 for(const response of [
  ()=>new Response('',{status:429}),()=>new Response('',{status:500}),()=>reply({errors:[{}],data:{createPost:{post:{id:'x'}}}}),
  ()=>reply({data:{createPost:{__typename:'PostActionSuccess',post:{id:'x',dueAt:at}}}}),
  ()=>new Response('not json'),()=>{throw Error('timeout')},()=>reply({}),()=>reply({errors:{}}),
 ]){
  const r=await createBufferSender('synthetic',async()=>response()).send(p);
  ok(r.state==='unknown','ambiguous reply never retry');
 }
 for(const status of [401,403]){
  ok((await createBufferSender('synthetic',async()=>new Response('',{status})).send(p)).code==='ACCESS_DENIED','auth failure terminal');
 }
 ok((await createBufferSender('synthetic',async()=>reply({data:{createPost:{__typename:'InvalidInputError',message:'do not log'}}})).send(p)).code==='REJECTED','typed rejection terminal');
 for(const extra of [{isQueuePaused:true},{isDisconnected:true},{isLocked:true},{name:'other'},{service:'facebook'}]){
  ok(!await createBufferSender('synthetic',async()=>reply({data:{channel:{...channel,...extra}}})).preflight(),'invalid channel blocks');
 }
 ok(!validateQueuedPromotion(candidate({hidden:true}),p,at),'send-time hidden');
 ok(!validateQueuedPromotion(candidate({title:'別作品'}),p,at),'reviewed body mismatch');

  const native=process.env.BUFFER_TEST_PORT;
 if(!native)throw Error('RUN_VIA_BUFFER_NATIVE_CHECK');
 const {Client}=require(path.join(process.env.BUFFER_TEST_RUNTIME,'node_modules/pg'));
 const connect=async()=>{

  const c=new Client({host:'127.0.0.1',port:Number(native),user:'fixture_admin',database:'postgres',statement_timeout:10000});
  await c.connect();
  return {query:(...args)=>c.query(...args),exec:sql=>c.query(sql),close:()=>c.end()};
 };
 let db=await connect();
 try{
  await db.exec(fixture);await db.exec(migration);await db.exec(fs.readFileSync('supabase/migrations/202610220030_buffer_delivery.sql','utf8').replaceAll('now()','public.buffer_test_now()'));
  await db.exec("INSERT INTO rooms VALUES ('"+room+"','共同制作の作品','forced_publish',false,null,false,'"+room+"','2026-10-22T00:00Z','2026-10-24T00:00Z');"+
   "INSERT INTO work_drafts VALUES ('"+room+"','[]','2026-10-22T00:00Z');");
  const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
  const snapshot=()=>scalar('SELECT buffer_snapshot()');
  ok((await snapshot()).candidates.length===0,'unreviewed denied by default');
  await db.exec("INSERT INTO buffer_reviews VALUES ('"+room+"',false,buffer_source_hash('"+room+"'),true,public.buffer_test_now());");
  ok((await snapshot()).candidates.some(c=>c.kind==='completed'),'reviewed DB candidate generated');
  const rpc=async(name,args={})=>{
   const names=Object.keys(args),values=Object.values(args).map(v=>v && typeof v==='object'?JSON.stringify(v):v);
   const expression=names.map((n,i)=>n+' => $'+(i+1)).join(',');
      if(native && ['buffer_claim','buffer_reserve','buffer_reserve_test'].includes(name)){
    const c=await connect();try{return {data:Object.values((await c.query('SELECT '+name+'('+expression+')',values)).rows[0])[0],error:null};}finally{await c.close()}
   }
   return {data:await scalar('SELECT '+name+'('+expression+')',values),error:null};
  };
  const before=await scalar('SELECT count(*) FROM buffer_queue');
  const dry=await runBuffer(rpc,{preflight:()=>{throw Error('no network')},send:()=>{throw Error('no send')}},'dry-run');
  ok(dry.writes===0&&dry.sends===0&&dry.planned===1&&dry.preSendEligible===1,'dry-run through pre-send, no network');
  ok(await scalar('SELECT count(*) FROM buffer_queue')===before,'dry-run leaves database unchanged');
  const planned=planPromotions((await snapshot()).candidates,[],at);
  const reservations=await Promise.all(Array.from({length:8},()=>rpc('buffer_reserve',{p_plan:planned})));
  ok(reservations.reduce((n,r)=>n+r.data,0)===1,'eight concurrent reservations insert once');
  await db.close();db=await connect();
  ok(Number(await scalar('SELECT count(*) FROM buffer_queue'))===1,'queue survives connection reopen');
  const claims=await Promise.all(Array.from({length:8},()=>rpc('buffer_claim',{p_event:null})));
  const q=claims.map(r=>r.data).find(Boolean);
  ok(claims.filter(r=>r.data).length===1,'eight concurrent claims yield one owner');
  ok(!(await rpc('buffer_finish',{p_event:q.event_id,p_token:room,p_state:'succeeded',p_code:'BUFFER_ACCEPTED',p_id:'x',p_due:p.dueAt})).data,'wrong fencing token rejected');
  await rpc('buffer_finish',{p_event:q.event_id,p_token:q.token,p_state:'failed',p_code:'PRECHECK_FAILED'});
  ok((await scalar('SELECT retry_at IS NOT NULL FROM buffer_queue'))===true,'pre-mutation failure schedules retry');
  ok((await rpc('buffer_claim')).data===null,'backoff respected');
  await db.exec("UPDATE buffer_clock SET instant=instant+interval '2 minutes'");
  const retry=(await rpc('buffer_claim')).data;
  ok(retry.attempts===2&&retry.token!==q.token,'retry retains event and rotates token');
  await rpc('buffer_finish',{p_event:retry.event_id,p_token:retry.token,p_state:'unknown',p_code:'AMBIGUOUS'});
  ok((await rpc('buffer_claim')).data===null,'unknown never reclaims');
  ok((await rpc('buffer_reserve',{p_plan:planned})).data===0,'unknown remains deduplicated');
  await db.exec("UPDATE buffer_queue SET state='sending',started_at=public.buffer_test_now()-interval '3 minutes'");
  await rpc('buffer_claim');
  ok(await scalar("SELECT state FROM buffer_queue")==='unknown','crashed worker becomes unknown');
  for(const [sql,restore,label] of [
   ["UPDATE rooms SET is_hidden=true","UPDATE rooms SET is_hidden=false",'hidden'],
   ["UPDATE rooms SET deleted_at=public.buffer_test_now()","UPDATE rooms SET deleted_at=null",'deleted'],
   ["UPDATE buffer_reviews SET excluded=true","UPDATE buffer_reviews SET excluded=false",'creator exclusion'],
   ["UPDATE buffer_reviews SET pii_clear=false","UPDATE buffer_reviews SET pii_clear=true",'PII'],
   ["UPDATE rooms SET title='changed'","UPDATE rooms SET title='共同制作の作品'",'content hash'],
   ["INSERT INTO report_intake VALUES ('"+room+"','room','"+room+"')","DELETE FROM report_intake",'unresolved report'],
   ["INSERT INTO reports VALUES ('"+room+"',null)","DELETE FROM reports",'legacy report'],
   ["INSERT INTO account_deletion_jobs VALUES ('"+room+"')","DELETE FROM account_deletion_jobs",'departing creator'],
  ]){
   await db.exec(sql);ok((await snapshot()).candidates.length===0,label+' blocks fresh DB snapshot');await db.exec(restore);
  }
  await db.exec("UPDATE buffer_queue SET state='queued',attempts=0; UPDATE buffer_clock SET instant='2026-10-22T11:20:00Z'");
  let sends=0;
  const r=await runBuffer(rpc,{preflight:async()=>true,send:async()=>{sends++;return {state:'succeeded',code:'BUFFER_ACCEPTED',id:'synthetic',dueAt:p.dueAt}}},'canary',p.eventId);
  ok(r.state==='succeeded'&&sends===1,'worker end-to-end canary persisted success');
  await runBuffer(rpc,{preflight:async()=>true,send:async()=>{sends++;throw Error('duplicate')}},'canary',p.eventId);
  ok(sends===1,'repeated canary cannot send twice');
  await db.exec("UPDATE buffer_queue SET state='queued'");
  const stopped=await runBuffer(rpc,{preflight:async()=>{
   await db.exec("UPDATE buffer_reviews SET excluded=true");return true;
  },send:async()=>{throw Error('must not send')}},'automatic');
  ok(stopped.state==='cancelled','opt-out between claim and send blocks mutation');
  await db.exec("UPDATE buffer_reviews SET excluded=false; UPDATE buffer_queue SET state='queued'");
  const flaky=async(name,args)=>name==='buffer_finish'?{data:null,error:{}}:rpc(name,args);
  await assert.rejects(runBuffer(flaky,{preflight:async()=>true,send:async()=>({state:'succeeded',code:'BUFFER_ACCEPTED',id:'synthetic',dueAt:p.dueAt})},'automatic'));
  ok(await scalar('SELECT state FROM buffer_queue')==='sending','lost success receipt leaves sending, not retry');
  for(const role of ['anon','authenticated','service_role']){
   await db.exec('SET ROLE '+role);
   await assert.rejects(db.query('SELECT * FROM buffer_queue'));await db.exec('RESET ROLE');
   ok(true,role+' cannot access raw queue');
  }
  for(const role of ['anon','authenticated']){
   await db.exec('SET ROLE '+role);await assert.rejects(db.query('SELECT buffer_snapshot()'));await db.exec('RESET ROLE');
   ok(true,role+' cannot call worker RPC');
  }
  await db.exec('SET ROLE service_role');
  ok(!!await snapshot(),'service role can call restricted RPC');await db.exec('RESET ROLE');
    await db.exec("TRUNCATE buffer_queue; UPDATE buffer_clock SET instant='2026-10-22T01:00:00Z'");
  for(const id of ['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333']){
   await db.query("INSERT INTO rooms SELECT $1,title,status,is_hidden,deleted_at,is_adult,created_by,started_at,expires_at FROM rooms LIMIT 1",[id]);
   await db.query("INSERT INTO work_drafts SELECT $1,blocks,published_at FROM work_drafts LIMIT 1",[id]);
   await db.query("INSERT INTO buffer_reviews VALUES ($1,false,buffer_source_hash($1),true,public.buffer_test_now())",[id]);
  }
  const capSnapshot=await snapshot(),capPlan=planPromotions(capSnapshot.candidates,[],capSnapshot.now);
  ok(capPlan.length===2&&capPlan.every(p=>p.kind==='completed'),'completed priority and two-slot plan');
  await Promise.all(Array.from({length:6},()=>rpc('buffer_reserve',{p_plan:capPlan})));
  ok(Number(await scalar('SELECT count(*) FROM buffer_queue'))===2,'concurrent daily cap at two');
  const aliases=capPlan.map(p=>({...p,eventId:p.eventId+'different'}));
  ok((await rpc('buffer_reserve',{p_plan:aliases})).data===0,'untrusted event identity cannot reserve');
  await db.exec("TRUNCATE buffer_queue; UPDATE rooms SET status='open'; UPDATE work_drafts SET published_at=null;");
  const recruitment=await snapshot(),newPlan=planPromotions(recruitment.candidates.filter(c=>c.kind==='new_room'),[],recruitment.now);
  ok(newPlan.length===1,'daily new room cap one');
  await db.exec("INSERT INTO room_members SELECT '"+room+"','supporter',null,gen_random_uuid(),public.buffer_test_now() FROM generate_series(1,45)");
  const full=await snapshot();
  ok(planPromotions(full.candidates.filter(c=>c.targetId===room),[],full.now).length===0,'full room rejected using live occupancy');
  await db.exec("TRUNCATE buffer_queue; DELETE FROM room_members; UPDATE rooms SET status='forced_publish'; UPDATE work_drafts SET published_at='2026-10-22T00:00Z'; UPDATE buffer_reviews SET reviewed_hash=buffer_source_hash(room_id); UPDATE buffer_clock SET instant='2026-10-22T11:20:00Z'");
  await rpc('buffer_reserve',{p_plan:[p]});
  await db.exec("UPDATE buffer_queue SET attempts=2");
  const last=(await rpc('buffer_claim')).data;
  await rpc('buffer_finish',{p_event:last.event_id,p_token:last.token,p_state:'failed',p_code:'PRECHECK_FAILED'});
  ok(await scalar('SELECT retry_at IS NULL FROM buffer_queue'),'third preflight failure is terminal');
    const {BUFFER_TEST_BODY,validateTestCanary}=load('lib/buffer/promotionPlanner.ts');
  const {runTestCanary}=load('lib/buffer/testCanary.ts');
  const testP={...p,text:BUFFER_TEST_BODY};
  ok(!validateTestCanary(candidate(),testP,at),'normal work cannot use TEST shortcut');
  ok(validateTestCanary(candidate({title:'TEST Buffer staging'}),testP,at),'TEST canary is limited to approved fixed text');
  ok(!validateTestCanary(candidate({title:'TEST Buffer staging'}),{...testP,text:'arbitrary'},at),'arbitrary canary text denied');
  await db.exec("TRUNCATE buffer_queue");
  ok((await rpc('buffer_reserve_test')).data===0,'empty authorization denies reservation');
  await db.exec("UPDATE rooms SET title='TEST Buffer staging'; UPDATE buffer_reviews SET reviewed_hash=buffer_source_hash(room_id)");
  await db.query("INSERT INTO buffer_test_authorization VALUES (true,$1,$2,$3,$4,true)",[room,p.eventId,p.dueAt,BUFFER_TEST_BODY]);
  const dryTest=await runTestCanary(rpc,{preflight:()=>{throw Error('no network')},send:()=>{throw Error('no mutation')}},true);
  ok(dryTest.eligible&&dryTest.writes===0,'authorized TEST dry-run remains read only');
  const testRes=await Promise.all(Array.from({length:8},()=>rpc('buffer_reserve_test')));
  ok(testRes.reduce((n,r)=>n+r.data,0)===1,'TEST concurrent reservations still idempotent');
  let canarySends=0;
  const resultTest=await runTestCanary(rpc,{preflight:async()=>true,send:async()=>{canarySends++;return {state:'succeeded',code:'BUFFER_ACCEPTED',id:'test_receipt',dueAt:p.dueAt}}},false);
  ok(resultTest.state==='succeeded'&&canarySends===1,'TEST worker sends exactly one');
  await runTestCanary(rpc,{preflight:async()=>{throw Error('already sent')},send:async()=>{throw Error('duplicate')}},false);
  ok(canarySends===1,'TEST repeated execution does not resend');
  const inspect=async(post)=>createBufferSender('synthetic',async()=>reply({data:{post:{id:'test_receipt',channelId:channel.id,channelService:'twitter',text:BUFFER_TEST_BODY,dueAt:p.dueAt,...post}}})).inspect('test_receipt',testP);
  ok((await inspect({status:'scheduled'})).state==='scheduled','scheduled receipt distinct from publication');
  ok((await inspect({status:'sent',sentAt:at,externalLink:'https://x.com/minnade_tsukuru/status/12345'})).state==='sent','published receipt has verified account URL');
  ok((await inspect({status:'sent',sentAt:at,externalLink:'https://x.com/other/status/12345'})).state==='unknown','wrong account publication rejected');
  ok((await inspect({status:'sent',sentAt:at,externalLink:'https://x.com/2021180454695731201/status/12345'})).externalUrl==='https://x.com/minnade_tsukuru/status/12345','verified numeric account URL normalized');
  ok((await inspect({status:'sent',sentAt:at,externalLink:'https://x.com/999999/status/12345'})).state==='unknown','other numeric account rejected');
  ok((await inspect({status:'scheduled',text:'different'})).state==='mismatch','read-back body mismatch unknown');
  ok((await inspect({status:'sending'})).state==='publishing','unconfirmed delivery not marked sent');
  ok((await rpc('buffer_reconcile',{p_event:p.eventId,p_buffer_id:'wrong',p_state:'sent',p_sent:at,p_external:'https://x.com/minnade_tsukuru/status/12345'})).data===false,'wrong Buffer id cannot reconcile');
  ok((await rpc('buffer_reconcile',{p_event:p.eventId,p_buffer_id:'test_receipt',p_state:'scheduled'})).data===true,'DB scheduled recorded');
  ok((await rpc('buffer_reconcile',{p_event:p.eventId,p_buffer_id:'test_receipt',p_state:'sent',p_sent:at,p_external:'https://x.com/minnade_tsukuru/status/12345'})).data===true,'DB sent with external id and timestamp');
  ok(await scalar("SELECT state='sent' AND external_id='12345' AND sent_at IS NOT NULL FROM buffer_queue"),'external receipt persisted');
  ok((await rpc('buffer_claim')).data===null,'published TEST never claimed again');

  await db.exec(fs.readFileSync('supabase/migrations/202610220031_buffer_delivery_control.sql','utf8').replaceAll('clock_timestamp()','public.buffer_test_now()').replaceAll('now()','public.buffer_test_now()').replaceAll('public.buffer_test_public.buffer_test_now()','public.buffer_test_now()'));
  const {maintainBuffer,runManagedBuffer}=load('lib/buffer/lifecycle.ts');
  const resetDelivery=async()=>{
   await db.exec("UPDATE rooms SET title='共同制作の作品',is_hidden=false; UPDATE buffer_reviews SET excluded=false,pii_clear=true,reviewed_hash=buffer_source_hash(room_id); UPDATE buffer_clock SET instant='2026-10-22T11:20:00Z'");
   await db.query("UPDATE buffer_queue SET body=$1,state='scheduled',buffer_id='test_receipt',due_at=$2,created_at='2026-10-22T11:00Z',sent_at=NULL,external_id=NULL,external_url=NULL,cancel_requested=false,checked_at=NULL,delivery_token=NULL,delivery_until=NULL,verify_failures=0,retry_at=NULL",[p.text,p.dueAt]);
   await db.exec('SELECT buffer_resume()');
  };
  ok((await rpc('buffer_control_state')).data.enabled===false,'031 defaults to stopped');
  await resetDelivery();
  const deliveryClaims=await Promise.all(Array.from({length:8},async()=>{const c=await connect();try{return (await c.query('SELECT buffer_delivery_claim() q')).rows[0].q;}finally{await c.close()}}));
  const lease=deliveryClaims.find(Boolean);
  ok(deliveryClaims.filter(Boolean).length===1,'eight delivery claims one lease');
  ok((await rpc('buffer_delivery_finish',{p_event:p.eventId,p_token:room,p_state:'sent',p_sent:at,p_external:'https://x.com/minnade_tsukuru/status/12345'})).data===false,'delivery wrong fencing token rejected');
  await assert.rejects(rpc('buffer_delivery_finish',{p_event:p.eventId,p_token:lease.delivery_token,p_state:'cancelled'}));ok(true,'cancel without intent rejected');
  let cancelled=0;
  const remote={preflight:async()=>true,send:async()=>{throw Error('no new send')},inspect:async()=>{return {state:'scheduled',cancellable:true};},cancel:async()=>{cancelled++;return 'cancelled'}};
  await resetDelivery();await db.exec('UPDATE rooms SET is_hidden=true');
  await maintainBuffer(rpc,remote);
  ok(await scalar('SELECT state FROM buffer_queue')==='cancelled'&&cancelled===1,'post-schedule hidden cancels remote reservation');
  ok((await rpc('buffer_control_state')).data.enabled===false,'excluded scheduled content stops only Buffer');
  await maintainBuffer(rpc,remote);ok(cancelled===1,'cancel duplicate safe');
  ok((await rpc('buffer_reconcile',{p_event:p.eventId,p_buffer_id:'test_receipt',p_state:'sent',p_sent:at,p_external:'https://x.com/minnade_tsukuru/status/12345'})).data===false,'cancelled cannot become sent');
  await resetDelivery();await db.exec('UPDATE buffer_reviews SET excluded=true');
  await maintainBuffer(rpc,{...remote,cancel:async()=> 'unknown'});
  ok(await scalar('SELECT state FROM buffer_queue')==='unknown','cancel timeout never confirmed');
  ok((await rpc('buffer_control_state')).data.enabled===false,'cancel timeout stops send');
  ok((await rpc('buffer_claim')).data===null,'unknown never automatically retried');
  await assert.rejects(rpc('buffer_resume'));ok(true,'unresolved unknown prevents manual resume');
  await resetDelivery();
  await maintainBuffer(rpc,{...remote,inspect:async()=>({state:'sent',sentAt:at,externalUrl:'https://x.com/minnade_tsukuru/status/54321'})});
  ok(await scalar("SELECT state='sent' AND external_id='54321' AND sent_at IS NOT NULL FROM buffer_queue"),'ordinary publication automatically reconciles');
  await resetDelivery();await maintainBuffer(rpc,{...remote,inspect:async()=>({state:'failed'})});
  ok(await scalar('SELECT state FROM buffer_queue')==='failed','remote failed does not retry send');
  await resetDelivery();
  for(let i=0;i<3;i++){await db.exec('UPDATE buffer_queue SET checked_at=NULL');await maintainBuffer(rpc,{...remote,inspect:async()=>({state:'unknown'})});}
  ok(await scalar('SELECT state FROM buffer_queue')==='unknown'&&(await rpc('buffer_control_state')).data.enabled===false,'three verification failures stop');
  await resetDelivery();await maintainBuffer(rpc,{...remote,inspect:async()=>({state:'publishing'})});
  ok(await scalar('SELECT state FROM buffer_queue')==='scheduled','publishing grace does not immediately fail');
  await resetDelivery();await db.exec('UPDATE rooms SET is_hidden=true');
  await maintainBuffer(rpc,{...remote,inspect:async()=>({state:'sent',sentAt:at,externalUrl:'https://x.com/minnade_tsukuru/status/54321'})});
  ok(await scalar('SELECT state FROM buffer_queue')==='sent'&&(await rpc('buffer_control_state')).data.reason==='UNSAFE_PUBLISHED','publication winning cancellation race recorded and stopped');
  await resetDelivery();await maintainBuffer(rpc,{...remote,inspect:async()=>({state:'mismatch'})});
  ok((await rpc('buffer_control_state')).data.enabled===false,'wrong remote identity immediately stops');
  await resetDelivery();await rpc('buffer_stop',{p_reason:'MANUAL'});await maintainBuffer(rpc,remote);
  ok(await scalar('SELECT state FROM buffer_queue')==='cancelled','OFF continues cancellation');
  const off=await runManagedBuffer(rpc,remote,'automatic');ok(off.stopped&&off.sends===0,'OFF blocks automatic new work');
  await db.exec('SELECT buffer_resume()');ok((await rpc('buffer_control_state')).data.enabled===true,'owner explicit resume supported');
  await resetDelivery();await db.exec("UPDATE buffer_queue SET state='sending',token='"+room+"'");
  await rpc('buffer_stop',{p_reason:'MANUAL'});
  ok((await rpc('buffer_send_guard',{p_event:p.eventId,p_token:room})).data===false,'stop during active worker fences send');
  await resetDelivery();await db.exec('SET ROLE service_role');
  await assert.rejects(db.query('SELECT buffer_resume()'));await assert.rejects(db.query('SELECT * FROM buffer_control'));await assert.rejects(db.query('SELECT buffer_claim_internal(null)'));await db.exec('RESET ROLE');
  ok(true,'service cannot resume or bypass control');
  for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(db.query('SELECT buffer_delivery_claim()'));await assert.rejects(db.query("SELECT buffer_stop('MANUAL')"));await db.exec('RESET ROLE');ok(true,role+' delivery/control denied');}
  const cancelApi=createBufferSender('synthetic',async()=>reply({data:{deletePost:{__typename:'DeletePostSuccess',id:'test_receipt'}}}));
  ok(await cancelApi.cancel('test_receipt')==='cancelled','typed delete success exact id');
  for(const transport of [async()=>{throw Error('timeout')},async()=>new Response('',{status:404}),async()=>reply({errors:[{}]}),async()=>reply({data:{deletePost:{__typename:'DeletePostSuccess',id:'other'}}})])ok(await createBufferSender('synthetic',transport).cancel('test_receipt')==='unknown','ambiguous delete not success');


  await db.exec(fs.readFileSync('supabase/migrations/202610220032_buffer_cancelled_capacity.sql','utf8').replaceAll('clock_timestamp()','public.buffer_test_now()').replaceAll('now()','public.buffer_test_now()').replaceAll('public.buffer_test_public.buffer_test_now()','public.buffer_test_now()'));
  await db.exec("UPDATE buffer_queue SET state='cancelled',buffer_id=NULL");
  ok((await snapshot()).history.every(h=>h.state==='cancelled'),'never-sent cancelled rows do not consume planner cap');
  await db.exec("UPDATE buffer_queue SET buffer_id='synthetic'");
  ok((await snapshot()).history.every(h=>h.state==='reserved'),'remote cancelled still consumes cap');
  await db.exec('SET ROLE service_role');await assert.rejects(db.query("SELECT buffer_reconcile('x','x','scheduled',null,null)"));await db.exec('RESET ROLE');
  ok(true,'unfenced legacy receipt RPC denied');
  await db.exec(fs.readFileSync('supabase/migrations/202610220033_buffer_cancel_test_text.sql','utf8'));
  ok(true,'fixed cancellation TEST text constraint migration');
  ok((await createBufferSender('synthetic',async()=>reply({errors:[{extensions:{code:'NOT_FOUND'},path:['post']}]})).inspect('test_receipt',p)).state==='missing','typed exact post NotFound recognized');
  ok((await createBufferSender('synthetic',async()=>reply({errors:[{extensions:{code:'UNAUTHENTICATED'},path:['post']}]})).inspect('test_receipt',p)).state==='unknown','auth errors never imply missing');

  await db.exec(fs.readFileSync('supabase/migrations/202610220034_buffer_release_guard.sql','utf8').replaceAll('clock_timestamp()','public.buffer_test_now()'));
  const held={...remote,inspect:async()=>({state:'held',cancellable:true}),release:async()=> 'released'};
  await resetDelivery();await maintainBuffer(rpc,held);
  ok(await scalar('SELECT release_started_at IS NULL FROM buffer_queue'),'held reservation cannot publish early');
  await resetDelivery();await db.query('UPDATE buffer_queue SET due_at=$1',[at]);let releases=0;
  await maintainBuffer(rpc,{...held,release:async()=>{releases++;return 'released'}});
  ok(releases===1&&await scalar('SELECT release_started_at IS NOT NULL FROM buffer_queue'),'due held post released once after guard');
  await db.exec('UPDATE buffer_queue SET checked_at=NULL');await maintainBuffer(rpc,{...held,release:async()=>{releases++;return 'released'}});
  ok(releases===1&&(await rpc('buffer_control_state')).data.enabled===false,'release uncertainty never repeats edit');
  await resetDelivery();await db.exec('UPDATE buffer_queue SET release_started_at=NULL');await rpc('buffer_stop',{p_reason:'MANUAL'});await maintainBuffer(rpc,held);
  ok(await scalar('SELECT state FROM buffer_queue')==='cancelled','stopped held draft is cancelled');
  await resetDelivery();await db.exec('UPDATE buffer_queue SET release_started_at=NULL');await maintainBuffer(rpc,remote);
  ok(await scalar('SELECT state FROM buffer_queue')==='cancelled','unexpected autonomous timed reservation cancelled');
  const draftSender=createBufferSender('synthetic',async(u,init)=>{assert.equal(JSON.parse(init.body).variables.input.saveToDraft,true);return reply({data:{createPost:{__typename:'PostActionSuccess',post:{id:'held',dueAt:null,status:'draft'}}}})});
  ok((await draftSender.send(p)).state==='succeeded','production sender defaults to nonpublishing draft');
  ok(await createBufferSender('synthetic',async()=>reply({data:{editPost:{__typename:'PostActionSuccess',post:{id:'held'}}}})).release('held')==='released','release exact remote id');
  ok(await createBufferSender('synthetic',async()=>{throw Error('timeout')}).release('held')==='unknown','release timeout is never retried');

  await db.exec(fs.readFileSync('supabase/migrations/202610230040_buffer_manual_test.sql','utf8').replaceAll('clock_timestamp()','public.buffer_test_now()').replaceAll('now()','public.buffer_test_now()').replaceAll('public.buffer_test_public.buffer_test_now()','public.buffer_test_now()'));
  await resetDelivery();await db.exec('UPDATE buffer_queue SET release_started_at=NULL');await rpc('buffer_stop',{p_reason:'MANUAL'});
  await db.query('UPDATE buffer_test_authorization SET enabled=true,due_at=$1',[at]);
  await db.query('UPDATE buffer_queue SET due_at=$1,body=$2',[at,BUFFER_TEST_BODY]);
  ok((await rpc('buffer_manual_test_allowed',{p_event:p.eventId})).data===true,'manual TEST authorization while auto OFF');
  ok((await rpc('buffer_claim')).data===null,'automatic claim remains OFF during manual TEST');
  let manualReleases=0;await maintainBuffer(rpc,{...held,release:async()=>{manualReleases++;return 'released'}},()=>true,p.eventId);
  ok(manualReleases===1&&(await rpc('buffer_control_state')).data.enabled===false,'manual TEST release preserves auto OFF');
  await db.exec('UPDATE buffer_queue SET checked_at=NULL');
  await maintainBuffer(rpc,{...held,inspect:async()=>({state:'sent',sentAt:at,externalUrl:'https://x.com/minnade_tsukuru/status/123456789'})},()=>true,p.eventId);
  ok(await scalar('SELECT state FROM buffer_queue')==='sent','manual TEST publication verified to sent');
  await rpc('buffer_stop',{p_reason:'VERIFY_UNKNOWN'});
  ok((await rpc('buffer_manual_test_allowed',{p_event:p.eventId})).data===false,'auto-stop revokes manual authorization too');
  for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(()=>rpc('buffer_manual_test_allowed',{p_event:p.eventId}));ok(true,'client cannot use manual TEST permission');await db.exec('RESET ROLE');}
  let input;await createBufferSender('synthetic',async(u,i)=>{input=JSON.parse(i.body).variables.input;return reply({data:{editPost:{__typename:'PostActionSuccess',post:{id:'held'}}}})}).release('held',p);
  ok(input.text===p.text&&input.dueAt===null&&input.mode==='shareNow','release explicitly preserves verified text and clears scheduled timestamp');

  await db.exec(`
   CREATE SCHEMA extensions; CREATE SCHEMA vault;
   CREATE TYPE extensions.http_header AS (field text,value text);
   CREATE TYPE extensions.http_request AS (method text,uri text,headers extensions.http_header[],content_type text,content text);
   CREATE TYPE extensions.http_response AS (status integer,content_type text,headers extensions.http_header[],content text);
   CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
   CREATE TABLE buffer_scheduler_config(singleton boolean PRIMARY KEY,enabled boolean,endpoint text,last_tick timestamptz,consecutive_failures integer DEFAULT 0,last_status integer);
   INSERT INTO buffer_scheduler_config(singleton,enabled,endpoint) VALUES(true,false,'https://minnade-tsukuru.vercel.app/api/cron/buffer');
   INSERT INTO vault.decrypted_secrets VALUES('minntuku_buffer_cron',repeat('c',32)),('minntuku_buffer_staging_automation',repeat('a',32));
   CREATE TABLE http_fixture(last_headers extensions.http_header[],calls integer DEFAULT 0,status integer DEFAULT 200,content_type text DEFAULT 'application/json',content text DEFAULT '{"mode":"dry-run"}');
   INSERT INTO http_fixture DEFAULT VALUES;
   CREATE FUNCTION extensions.http_set_curlopt(text,text) RETURNS boolean LANGUAGE sql AS 'SELECT true';
   CREATE FUNCTION extensions.http(r extensions.http_request) RETURNS extensions.http_response LANGUAGE plpgsql AS $$ DECLARE f http_fixture%ROWTYPE; BEGIN UPDATE http_fixture SET last_headers=r.headers,calls=calls+1 RETURNING * INTO f; RETURN ROW(f.status,f.content_type,NULL,f.content)::extensions.http_response; END $$;
  `);
  await db.exec(fs.readFileSync('supabase/migrations/202610230041_buffer_staging_scheduler_auth.sql','utf8'));
  ok(await scalar('SELECT buffer_scheduler_tick()')===null&&await scalar('SELECT calls FROM http_fixture')===0,'disabled scheduler never calls HTTP');
  await db.exec('UPDATE buffer_scheduler_config SET enabled=true');
  ok(Number(await scalar('SELECT buffer_scheduler_tick()'))===200&&await scalar('SELECT cardinality(last_headers) FROM http_fixture')===1,'production scheduler sends only cron authorization');
  await db.exec("UPDATE buffer_scheduler_config SET endpoint='https://minnade-tsukuru-staging-test.vercel.app/api/cron/buffer'");
  ok(Number(await scalar('SELECT buffer_scheduler_tick()'))===200&&await scalar('SELECT cardinality(last_headers) FROM http_fixture')===2,'staging scheduler adds dedicated automation credential');
  await db.exec("UPDATE vault.decrypted_secrets SET decrypted_secret='' WHERE name='minntuku_buffer_staging_automation'");
  const callsBefore=await scalar('SELECT calls FROM http_fixture');
  ok(await scalar('SELECT buffer_scheduler_tick()')===null&&await scalar('SELECT calls FROM http_fixture')===callsBefore,'missing staging credential fails closed before network');
  await db.exec("UPDATE vault.decrypted_secrets SET decrypted_secret=repeat('a',32) WHERE name='minntuku_buffer_staging_automation'; UPDATE http_fixture SET content_type='text/html'");
  ok(Number(await scalar('SELECT buffer_scheduler_tick()'))===502,'SSO HTML 200 cannot pass scheduler verification');
  await db.exec('SELECT buffer_scheduler_tick(); SELECT buffer_scheduler_tick()');
  ok((await rpc('buffer_control_state')).data.enabled===false&&await scalar('SELECT consecutive_failures FROM buffer_scheduler_config')===3,'three scheduler failures stop Buffer');
  for(const role of ['anon','authenticated','service_role']){await db.exec('SET ROLE '+role);await assert.rejects(db.query('SELECT buffer_scheduler_tick()'));await db.exec('RESET ROLE');ok(true,role+' cannot execute owner scheduler');}
  const competing=await connect();try{await competing.exec('BEGIN; SELECT pg_advisory_xact_lock(54221037)');ok(await scalar('SELECT buffer_scheduler_tick()')===null,'overlapping scheduler invocation skips HTTP');}finally{await competing.exec('ROLLBACK');await competing.close();}
  console.log('BUFFER_QUEUE_CHECKS '+checks+' PASS');
  console.log('DRY_RUN synthetic candidates=2 planned=1 preSendEligible=1 writes=0 sends=0');
 } finally {await db.close()}
}
main().catch(e=>{console.error('BUFFER_QUEUE_CHECK_FAILED',e.message);process.exitCode=1});
