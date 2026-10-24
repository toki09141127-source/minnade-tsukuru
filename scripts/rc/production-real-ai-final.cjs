/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit user confirmation: USD5 available, auto recharge OFF. At most two remaining calls after the credit-limit diagnosis; stop on first failure, no retry.
const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),crypto=require('crypto'),assert=require('node:assert/strict'),tls=require('tls');
const {createClient}=require('@supabase/supabase-js'),ctx=require('../staging/safety.cjs').load();
assert.equal(ctx.ref,'fwqucffxdmbdczspkcyr');assert.ok(ctx.env.OPENAI_API_KEY);
const out={scope:'remaining real provider contracts + bounded system publication; draft user credit gate is retained, no Hosted real-AI claim',projectRef:ctx.ref,startedAt:new Date().toISOString(),apiCalls:0,maxCalls:2,priorCalls:6,totalCallLimit:8,complete:false,checks:[],usage:[],productionChanges:'NONE',paymentConfigurationChanged:false};
const file='docs/v2-production-real-ai-final-result.json';
assert.equal(JSON.parse(fs.readFileSync('docs/v2-production-real-ai-result.json')).apiCalls,2);assert.equal(JSON.parse(fs.readFileSync('docs/v2-production-ai-diagnostic.json')).calls,1);assert.equal(JSON.parse(fs.readFileSync('docs/v2-production-real-ai-fixed-result.json')).apiCalls,3);
if(fs.existsSync(file))throw Error('REAL_AI_RESULT_EXISTS_REVIEW_BEFORE_RETRY');
const save=()=>fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');save();
const nativeFetch=global.fetch;
const fetchBound=async(input,...args)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(u.origin!=='https://api.openai.com'||u.pathname!=='/v1/responses')throw Error('PROVIDER_NETWORK_BOUNDARY');if(out.apiCalls>=2)throw Error('CALL_BUDGET');out.apiCalls++;out.totalCallsIncludingPrior=6+out.apiCalls;save();return nativeFetch(input,...args)};
const cache=new Map(),load=file=>{if(cache.has(file))return cache.get(file);const m={exports:{}};cache.set(file,m.exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>n==='server-only'?{}:n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.join(path.dirname(file),n)+'.ts'):require(n),process:{env:ctx.env},fetch:fetchBound,AbortSignal,Date,Set,Error});cache.set(file,m.exports);return m.exports};
const {OpenAiProvider}=load('lib/ai/provider.ts'),safe=load('lib/ai/safety.ts');
const model=ctx.env.AI_MODEL||'gpt-4.1-mini-2025-04-14';assert.equal(model,'gpt-4.1-mini-2025-04-14');const provider=new OpenAiProvider(ctx.env.OPENAI_API_KEY,model);
const f=JSON.parse(fs.readFileSync('.staging-private/v2rc-e2e.json'));assert.equal(f.projectRef,ctx.ref);const users=['owner','free','outsider'].map(l=>f.users.find(x=>x.label===l));users.forEach(x=>assert.match(x.email,/^v2rc-.*@example\.invalid$/));
let db,initial,room,clients=[],active;
const rpc=async(c,n,args={})=>{const r=await c.rpc(n,args);if(r.error)throw Error('RPC_'+n.toUpperCase());return r.data};
const ok=name=>{out.checks.push({name,pass:true});save()};
const admin=createClient(ctx.url,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const feature=async(value)=>{const s=await rpc(clients[0],'v25_admin_read',{p_section:'system'});const a=await rpc(clients[0],'v25_admin_action',{p_request:crypto.randomUUID(),p_action:'feature',p_type:'system',p_target:'ai',p_version:s.detail.version,p_value:value,p_reason:'operational',p_note:'RC bounded real provider acceptance; restore original stop'});if(a.error)throw Error('FEATURE_CONTROL')};
(async()=>{try{
 const u=new URL(ctx.env.STAGING_DATABASE_URL);assert.equal(u.hostname,'aws-0-ap-southeast-2.pooler.supabase.com');assert.equal(decodeURIComponent(u.username),'postgres.'+ctx.ref);assert.equal(u.port,'5432');assert.equal(u.pathname,'/postgres');const {Client}=require(path.join(ctx.env.MVP_TEST_RUNTIME,'node_modules/pg'));db=new Client({host:u.hostname,port:5432,user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:'postgres',ssl:{rejectUnauthorized:true,ca:tls.rootCertificates.join('\n')+'\n'+fs.readFileSync('C:/Users/Sonet/AppData/Local/minnade-release-private/release52/supabase-prod-ca.crt','utf8')},connectionTimeoutMillis:15000,statement_timeout:30000});await db.connect();
 initial=(await db.query('SELECT enabled FROM mvp_private.ai_control WHERE singleton')).rows[0].enabled;
 for(const u of users){const c=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const r=await c.auth.signInWithPassword({email:u.email,password:u.password});assert.ok(!r.error,'FIXTURE_LOGIN');clients.push(c)}
 await feature(true);
 const fixture=JSON.parse(fs.readFileSync('.staging-private/v2-production-real-ai-fixture.json'));assert.equal(fixture.projectRef,ctx.ref);assert.equal(fixture.userIds[1],users[1].id);room=fixture.room;
 const checked=(await db.query('SELECT title,created_by,status FROM public.rooms WHERE id=$1',[room])).rows[0];assert.equal(checked.title,'TEST RC real AI acceptance');assert.equal(checked.created_by,users[1].id);assert.equal(checked.status,'open');
 assert.equal((await db.query('SELECT count(*)::int n FROM public.posts WHERE room_id=$1 AND user_id IS DISTINCT FROM $2',[room,users[1].id])).rows[0].n,0);
 let expectedTask;
 const finish=async(label)=>{
  const t=await rpc(admin,'v22_ai_claim',{p_room:room});assert.ok(t&&t.roomId===room,'EXACT_ROOM_CLAIM');active=t;assert.equal(t.id,expectedTask,'EXACT_REQUEST_CLAIM');
  t.context=safe.validateContext(t.context);assert.equal(t.context.title,'TEST RC real AI acceptance');assert.ok(!JSON.stringify(t.context).includes('@example.invalid'),'NO_AUTH_PII');
  let r;try{r=await provider.generate(t)}catch(e){await rpc(admin,'v22_ai_finish',{p_task:t.id,p_lease:t.lease,p_output:null,p_usage:{},p_error:e.code||'PROVIDER_UNAVAILABLE'});active=null;out.providerFailure={code:e.code||'UNKNOWN',httpStatus:e.httpStatus,providerCode:e.providerCode};throw Error('REAL_PROVIDER_FAILED')}
  const state=await rpc(admin,'v22_ai_finish',{p_task:t.id,p_lease:t.lease,p_output:r.output,p_usage:r.usage,p_error:null});active=null;assert.equal(state,'succeeded','DB_ACCEPTS_REAL_OUTPUT');
  const input=r.usage.inputTokens,output=r.usage.outputTokens;out.usage.push({scenario:label,model:r.usage.model,modelTier:t.modelTier||'cheap',inputTokens:input,outputTokens:output,durationMs:r.usage.durationMs,estimatedUsd:input*0.4/1e6+output*1.6/1e6,contextChars:JSON.stringify(t.context).length});ok(label+' real response/schema + staging finish');
 };
 // The shared synthetic Free account has 1 credit left; do not reset its ledger or bypass paid capability.
 const credits=(await db.query('SELECT p.granted-p.consumed-p.reserved remaining FROM public.ai_credit_periods p JOIN public.billing_accounts a ON a.id=p.account_id WHERE a.owner_id=$1 ORDER BY p.period_end DESC LIMIT 1',[users[1].id])).rows[0];assert.ok(credits.remaining<20,'EXPECTED_CREDIT_LIMIT');out.manualDraftBlockedByCredits=true;
 const draftContext=safe.validateContext((await db.query('SELECT mvp_private.build_safe_ai_room_context($1) value',[room])).rows[0].value);
 const d=await provider.generate({id:'bounded-contract-only',roomId:room,lease:'not-claimed',kind:'draft_assist',trigger:'manual',text:'このルームの既存の内容だけを使い、未確定の短いドラフト案を提案してください。',context:draftContext,attempt:1});
 const valid=(await db.query('SELECT mvp_private.ai_valid_output($1::jsonb,$2::jsonb,$3) valid',[JSON.stringify(d.output),JSON.stringify(draftContext),'draft_assist'])).rows[0].valid;assert.equal(valid,true);assert.ok(d.output.draftText.length>0);
 out.usage.push({scenario:'draft assist contract only (manual credit limit retained)',model:d.usage.model,inputTokens:d.usage.inputTokens,outputTokens:d.usage.outputTokens,durationMs:d.usage.durationMs,estimatedUsd:d.usage.inputTokens*0.4/1e6+d.usage.outputTokens*1.6/1e6,contextChars:JSON.stringify(draftContext).length});ok('real draft response + read-only DB validator; not saved or accepted as a user draft');
 // Accelerate only the new synthetic room clock, under a bounded local fixture transaction.
 await db.query('BEGIN');await db.query("SET LOCAL session_replication_role='replica'");const clock=await db.query("UPDATE public.rooms SET expires_at=now()-interval '1 minute' WHERE id=$1 AND created_by=$2 AND title='TEST RC real AI acceptance' AND v2_enabled RETURNING id",[room,users[1].id]);assert.equal(clock.rowCount,1);await db.query('COMMIT');
 expectedTask=(await db.query("SELECT mvp_private.ai_enqueue($1,'publication','organize','publication') id",[room])).rows[0].id;
 await finish('forced publish organization');
 const denied=await clients[2].rpc('v22_ai_state',{p_room:room});assert.ok(denied.error);ok('cross-room outsider denied before publication');
 await db.query('SELECT public.v22_publish_room($1)',[room]);const count=(await db.query('SELECT count(*)::int n FROM public.v2_work_snapshots WHERE room_id=$1',[room])).rows[0].n;assert.equal(count,1);ok('one completed snapshot after real publication assistance');
 await feature(false);assert.equal(await rpc(admin,'v22_ai_claim',{p_room:room}),null);ok('feature stop blocks new claims');
 out.estimatedTotalUsd=out.usage.reduce((a,x)=>a+x.estimatedUsd,0);out.complete=true;
}catch(e){out.failure={code:e.code||'CHECK_FAILED',check:/^[A-Z0-9_]+$/.test(e.message||'')?e.message:'ASSERTION'};process.exitCode=1}
finally{if(db)await db.query('ROLLBACK').catch(()=>{});if(active)try{await rpc(admin,'v22_ai_finish',{p_task:active.id,p_lease:active.lease,p_output:null,p_usage:{},p_error:'AI_STOPPED'})}catch{};if(initial!==undefined&&clients[0])try{const current=(await db.query('SELECT enabled FROM mvp_private.ai_control WHERE singleton')).rows[0].enabled;if(current!==initial)await feature(initial);out.originalAiStopRestored=true}catch{out.originalAiStopRestored=false;out.complete=false}
 for(const c of clients)await c.auth.signOut().catch(()=>{});out.testSessionsSignedOut=true;if(db)await db.end();out.finishedAt=new Date().toISOString();save();console.log(JSON.stringify(out));process.exitCode=out.complete?0:1;process.exit(process.exitCode)}
})();
