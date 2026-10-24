/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit user confirmation: USD5 available, auto recharge OFF. At most six real calls, no retry.
const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),crypto=require('crypto'),assert=require('node:assert/strict'),tls=require('tls');
const {createClient}=require('@supabase/supabase-js'),ctx=require('../staging/safety.cjs').load();
assert.equal(ctx.ref,'fwqucffxdmbdczspkcyr');assert.ok(ctx.env.OPENAI_API_KEY);
const out={scope:'real OpenAI + actual staging synthetic fixture; no Hosted real-AI claim',projectRef:ctx.ref,startedAt:new Date().toISOString(),apiCalls:0,maxCalls:6,complete:false,checks:[],usage:[],productionChanges:'NONE',paymentConfigurationChanged:false};
const file='docs/v2-production-real-ai-result.json';
if(fs.existsSync(file))throw Error('REAL_AI_RESULT_EXISTS_REVIEW_BEFORE_RETRY');
const save=()=>fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');save();
const nativeFetch=global.fetch;
const fetchBound=async(input,...args)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(u.origin!=='https://api.openai.com'||u.pathname!=='/v1/responses')throw Error('PROVIDER_NETWORK_BOUNDARY');if(out.apiCalls>=6)throw Error('CALL_BUDGET');out.apiCalls++;save();return nativeFetch(input,...args)};
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
 room=await rpc(clients[1],'v2_create_room',{p_request:crypto.randomUUID(),p_title:'TEST RC real AI acceptance',p_description:'架空の森を仲間たちと旅する短い物語を共同制作するための検収ルームです。',p_genre:'novel',p_deadline:new Date(Date.now()+86400000).toISOString(),p_capacity:10,p_ai:'assist',p_consent:'2026-10-22-v2.1'});
 fs.writeFileSync('.staging-private/v2-production-real-ai-fixture.json',JSON.stringify({projectRef:ctx.ref,room,userIds:users.map(x=>x.id),initialAi:initial}));
 const finish=async(label)=>{
  const t=await rpc(admin,'v22_ai_claim',{p_room:room});assert.ok(t&&t.roomId===room,'EXACT_ROOM_CLAIM');active=t;
  t.context=safe.validateContext(t.context);assert.equal(t.context.title,'TEST RC real AI acceptance');assert.ok(!JSON.stringify(t.context).includes('@example.invalid'),'NO_AUTH_PII');
  let r;try{r=await provider.generate(t)}catch(e){await rpc(admin,'v22_ai_finish',{p_task:t.id,p_lease:t.lease,p_output:null,p_usage:{},p_error:e.code||'PROVIDER_UNAVAILABLE'});active=null;out.providerFailure={code:e.code||'UNKNOWN',httpStatus:e.httpStatus,providerCode:e.providerCode};throw Error('REAL_PROVIDER_FAILED')}
  const state=await rpc(admin,'v22_ai_finish',{p_task:t.id,p_lease:t.lease,p_output:r.output,p_usage:r.usage,p_error:null});active=null;assert.equal(state,'succeeded','DB_ACCEPTS_REAL_OUTPUT');
  const input=r.usage.inputTokens,output=r.usage.outputTokens;out.usage.push({scenario:label,model:r.usage.model,modelTier:t.modelTier||'cheap',inputTokens:input,outputTokens:output,durationMs:r.usage.durationMs,estimatedUsd:input*0.4/1e6+output*1.6/1e6,contextChars:JSON.stringify(t.context).length});ok(label+' real response/schema + staging finish');
 };
 await finish('greeting');
 await rpc(admin,'create_post_with_upload',{p_actor:users[1].id,p_room:room,p_content:'決定：舞台は架空の森です。提案：登場人物が助け合う場面を相談します。',p_post_type:'log',p_upload:null,p_request_key:crypto.randomUUID()});
 for(const [kind,label] of [['question','simple @AI'],['summarize','summary']]){await rpc(clients[1],'v24_ai_request',{p_room:room,p_request:crypto.randomUUID(),p_class:kind,p_text:'このルームの内容だけを使い、未決定は提案として整理してください。'});await finish(label)}
 for(let n=0;n<3;n++)await rpc(admin,'create_post_with_upload',{p_actor:users[1].id,p_room:room,p_content:('提案：森の仲間が小さな発見を持ち寄り、互いの考えを聞いて旅の場面を相談します。').repeat(16),p_post_type:'log',p_upload:null,p_request_key:crypto.randomUUID()});
 for(const [kind,label] of [['organize','long log organization'],['draft_assist','draft assist']]){await rpc(clients[1],'v24_ai_request',{p_room:room,p_request:crypto.randomUUID(),p_class:kind,p_text:'このルームの内容だけを使い、未決定は提案として整理してください。'});await finish(label)}
 // Accelerate only the new synthetic room clock, under a bounded local fixture transaction.
 await db.query('BEGIN');await db.query("SET LOCAL session_replication_role='replica'");const clock=await db.query("UPDATE public.rooms SET expires_at=now()-interval '1 minute' WHERE id=$1 AND created_by=$2 AND title='TEST RC real AI acceptance' AND v2_enabled RETURNING id",[room,users[1].id]);assert.equal(clock.rowCount,1);await db.query('COMMIT');
 await db.query("SELECT mvp_private.ai_enqueue($1,'publication','organize','publication')",[room]);
 await finish('forced publish organization');
 await db.query('SELECT public.v22_publish_room($1)',[room]);const count=(await db.query('SELECT count(*)::int n FROM public.v2_work_snapshots WHERE room_id=$1',[room])).rows[0].n;assert.equal(count,1);ok('one completed snapshot after real publication assistance');
 const denied=await clients[2].rpc('v22_ai_state',{p_room:room});assert.ok(denied.error);ok('cross-room outsider denied');
 await feature(false);assert.equal(await rpc(admin,'v22_ai_claim',{p_room:room}),null);ok('feature stop blocks new claims');
 out.estimatedTotalUsd=out.usage.reduce((a,x)=>a+x.estimatedUsd,0);out.complete=true;
}catch(e){out.failure={code:e.code||'CHECK_FAILED',check:/^[A-Z0-9_]+$/.test(e.message||'')?e.message:'ASSERTION'};process.exitCode=1}
finally{if(db)await db.query('ROLLBACK').catch(()=>{});if(active)try{await rpc(admin,'v22_ai_finish',{p_task:active.id,p_lease:active.lease,p_output:null,p_usage:{},p_error:'AI_STOPPED'})}catch{};if(initial!==undefined&&clients[0])try{const current=(await db.query('SELECT enabled FROM mvp_private.ai_control WHERE singleton')).rows[0].enabled;if(current!==initial)await feature(initial);out.originalAiStopRestored=true}catch{out.originalAiStopRestored=false;out.complete=false}
 for(const c of clients)await c.auth.signOut().catch(()=>{});out.testSessionsSignedOut=true;if(db)await db.end();out.finishedAt=new Date().toISOString();save();console.log(JSON.stringify(out));process.exitCode=out.complete?0:1;process.exit(process.exitCode)}
})();
