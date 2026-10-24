/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const results=[];let env={},calls=[],response,confirmError=null,cancelError=false,authenticated=true,adminRole=false;
const account='11111111-1111-4111-8111-111111111111',job={id:'job-fixture',lease:'lease-fixture',actorId:'actor-fixture',stage:'requested'};
const prod={NEXT_PUBLIC_SUPABASE_URL:'https://joedeuyrzimqyjapqpyh.supabase.co',VERCEL_ENV:'production'};
const stage={NEXT_PUBLIC_SUPABASE_URL:'https://fwqucffxdmbdczspkcyr.supabase.co',V2_ENABLED:'true',BILLING_ENABLED:'true',BILLING_PROVIDER:'stripe_test',STRIPE_TEST_SECRET_KEY:'sk_test_fixtureNotASecret'};
const client={auth:{getUser:async()=>({data:{user:authenticated?{id:'fixture'}:null},error:null})},rpc:async(name)=>{calls.push(name);if(name==='v25_admin_read')return {data:adminRole?{detail:{}}:{error:'ADMIN_FORBIDDEN'},error:null};return name==='v24_deletion_context'?response:{data:null,error:confirmError}}};
const cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  module:m,exports:m.exports,process:{get env(){return env}},URL,Date,Set,Map,Error,AbortSignal,Request,Response,
  fetch:()=>{throw Error('NETWORK_FORBIDDEN')},
  require:name=>{
   if(name==='server-only')return {};
   if(name==='next/server')return {NextResponse:{json:(body,options)=>Response.json(body,options)}};
   if(name==='@supabase/supabase-js')return {createClient:()=>client};
   if(name==='./stripe'&&file==='lib/billing/deletion.ts')return {StripeTestProvider:class{async cancelAll(){calls.push('stripe_cancel');if(cancelError)throw Error('SYNTHETIC_PROVIDER_FAILURE')}}};
   if(name==='./accountDeletionControl')return {deletionRpc:async(c,n,a)=>{calls.push(n);if(n==='mvp_deletion_cleanup_candidates')return [];if(n==='mvp_verify_deletion')return {jobId:a.p_id,actorId:job.actorId,storageReadyForAuthDeletion:true};return null},deletionCheckpoint:async()=>calls.push('checkpoint')};
   if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
   if(name.startsWith('.'))return load(path.posix.normalize(path.posix.join(path.posix.dirname(file),name))+'.ts');
   return {};
  }
 });return m.exports;
}
const deletion=load('lib/billing/deletion.ts').prepareBillingDeletion;
const prepare=load('lib/accountDeletionPreparation.ts').createFinalDeletionPreparation;
const reset=(config,data={account,customer:null,provider:null,confirmed:false})=>{env={...config};calls=[];response={data,error:null};confirmError=null;cancelError=false};
const test=async(name,fn)=>{await fn();results.push({name,pass:true})};
(async()=>{try{
 await test('Free production retirement confirms without Stripe even with UI OFF',async()=>{reset({...prod,V2_SCHEMA_VERSION:'58'});await deletion(client,job);assert.deepEqual(calls,['v24_deletion_context','v24_deletion_confirm'])});
 await test('Installed schema is detected even without UI/schema flag',async()=>{reset(prod);await deletion(client,job);assert.equal(calls.at(-1),'v24_deletion_confirm')});
 await test('Old MVP accepts only missing RPC',async()=>{reset(prod);response.error={code:'PGRST202'};await deletion(client,job);assert.equal(calls.length,1)});
 for(const config of [{...prod,V2_SCHEMA_VERSION:'58'},{...prod,V2_ENABLED:'true'},stage])await test('Expected V2 schema missing fails closed '+results.length,async()=>{reset(config);response.error={code:'PGRST202'};await assert.rejects(deletion(client,job));assert.equal(calls.length,1)});
 for(const code of ['42501','PGRST301','PGRST000','BILLING_OPERATION_UNCERTAIN'])await test('RPC failure never skips retirement: '+code,async()=>{reset(prod);response.error={code};await assert.rejects(deletion(client,job))});
 for(const config of [{},{...prod,VERCEL_ENV:'preview'},{...stage,VERCEL_ENV:'production'},{...prod,NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid'}])await test('Unknown/mixed environment rejected before RPC '+results.length,async()=>{reset(config);await assert.rejects(deletion(client,job));assert.equal(calls.length,0)});
 for(const confirmed of [false,true])await test('Production customer blocked even with confirmation '+confirmed,async()=>{reset(prod,{account,customer:'cus_fixture',provider:'stripe_test',confirmed});await assert.rejects(deletion(client,job));assert.equal(calls.length,1)});
 await test('Free account absent needs no provider',async()=>{reset(prod,null);await deletion(client,job);assert.equal(calls.length,1)});
 await test('Confirmation replay is idempotent',async()=>{reset(prod,{account,customer:null,provider:null,confirmed:true});await deletion(client,job);assert.equal(calls.length,1)});
 for(const bad of [{},{account,customer:null,provider:'stripe_live',confirmed:false},{account,customer:'wrong',provider:'stripe_test',confirmed:false},{account,customer:null,provider:null,confirmed:'true'}])await test('Malformed provider state rejected '+results.length,async()=>{reset(stage,bad);await assert.rejects(deletion(client,job))});
 await test('Test provider cancellation precedes confirmation',async()=>{reset(stage,{account,customer:'cus_fixture',provider:'stripe_test',confirmed:false});await deletion(client,job);assert.deepEqual(calls,['v24_deletion_context','stripe_cancel','v24_deletion_confirm'])});
 await test('Provider failure never confirms retirement',async()=>{reset(stage,{account,customer:'cus_fixture',provider:'stripe_test',confirmed:false});cancelError=true;await assert.rejects(deletion(client,job));assert.ok(!calls.includes('v24_deletion_confirm'))});
 await test('Confirmation failure is resumable',async()=>{reset(prod);confirmError={code:'FAIL'};await assert.rejects(deletion(client,job));confirmError=null;await deletion(client,job);assert.equal(calls.filter(x=>x==='v24_deletion_confirm').length,2)});
 await test('Billing failure prevents preparation and storage',async()=>{reset(prod);await assert.rejects(prepare(client,async()=>{calls.push('billing');throw Error('STOP')}).prepare(job));assert.deepEqual(calls,['billing'])});
 await test('Billing verified before preparation and again before Auth receipt',async()=>{reset(prod);await prepare(client,async()=>calls.push('billing')).prepare(job);assert.equal(calls[0],'billing');assert.ok(calls.indexOf('billing')<calls.indexOf('mvp_prepare_deletion'));assert.equal(calls.at(-2),'billing');assert.equal(calls.at(-1),'mvp_verify_deletion')});
 for(const p of ['app/api/account/delete/route.ts','app/api/cron/account-deletion/route.ts'])await test('Retirement hook survives UI OFF: '+p,async()=>{const source=fs.readFileSync(p,'utf8');assert.ok(source.includes('await prepareBillingDeletion(supabaseAdmin, job)'));assert.ok(!source.includes('process.env.V2_ENABLED'))});
 const ai=load('lib/ai/provider.ts');
 for(const provider of ['synthetic','openai'])await test('Production AI blocked even if accidentally enabled: '+provider,async()=>{env={...prod,AI_ENABLED:'true',AI_PROVIDER:provider,OPENAI_API_KEY:'fixture',STAGING_TEST:'true',V2_RC_SYNTHETIC_AI:'true'};assert.equal(ai.aiConfigured(),false)});
 const v2=load('lib/v2/server.ts'),admin=load('lib/admin/server.ts');
 const allowed={...prod,V2_ENABLED:'true',V2_RELEASE_MODE:'free',V2_SCHEMA_VERSION:'58',ADMIN_ENABLED:'true'};
 await test('Explicit Free production configuration opens human and admin gates only',async()=>{env={...allowed};assert.equal(v2.v2Enabled(),true);assert.equal(admin.adminEnabled(),true)});
 for(const [key,value] of [['V2_ENABLED','false'],['V2_RELEASE_MODE','full'],['V2_SCHEMA_VERSION','57'],['VERCEL_ENV','preview'],['NEXT_PUBLIC_SUPABASE_URL','https://example.invalid']])await test('Missing/mismatched release condition denied: '+key,async()=>{env={...allowed,[key]:value};assert.equal(v2.v2Enabled(),false);assert.equal(admin.adminEnabled(),false)});
 await test('Admin flag remains independent',async()=>{env={...allowed,ADMIN_ENABLED:'false'};assert.equal(v2.v2Enabled(),true);assert.equal(admin.adminEnabled(),false)});
 await test('Old production V2 flag alone cannot enable release',async()=>{env={...prod,V2_ENABLED:'true'};assert.equal(v2.v2Enabled(),false)});
 await test('Staging cannot be used by a production deployment',async()=>{env={...stage,VERCEL_ENV:'production'};assert.equal(v2.v2Enabled(),false)});
 const server=load('lib/billing/server.ts');env={...allowed,BILLING_ENABLED:'true',BILLING_PROVIDER:'stripe_test',STRIPE_TEST_SECRET_KEY:'sk_test_fixture'};
 await test('Production Stripe remains unavailable',async()=>{assert.equal(server.billingEnabled(),false)});
 env={...allowed,VERCEL:'1',VERCEL_URL:'deployment-fixture.vercel.app'};
 const request=(origin,host=new URL(origin).host,site='same-origin')=>new Request('https://minnade-tsukuru.vercel.app/api/admin',{headers:{origin,host,'sec-fetch-site':site}});
 await test('Exact production alias accepted with matching Host',async()=>assert.equal(admin.adminSameOrigin(request('https://minnade-tsukuru.vercel.app')),true));
 for(const args of [['https://minnade-tsukuru.vercel.app','evil.invalid'],['https://evil.invalid'],['http://minnade-tsukuru.vercel.app'],['https://minnade-tsukuru.vercel.app','minnade-tsukuru.vercel.app','cross-site']])await test('Cross-origin/spoofed admin request refused '+results.length,async()=>assert.equal(admin.adminSameOrigin(request(...args)),false));
 const adminRoute=load('app/api/admin/route.ts');
 await test('Production admin unauthenticated caller is 401',async()=>{assert.equal((await adminRoute.GET(new Request('https://minnade-tsukuru.vercel.app/api/admin'))).status,401)});
 await test('Production admin invalid session is 401',async()=>{authenticated=false;assert.equal((await adminRoute.GET(new Request('https://minnade-tsukuru.vercel.app/api/admin',{headers:{authorization:'Bearer fixture'}}))).status,401);authenticated=true});
 await test('Production admin authenticated non-staff is 403',async()=>{adminRole=false;assert.equal((await adminRoute.GET(new Request('https://minnade-tsukuru.vercel.app/api/admin',{headers:{authorization:'Bearer fixture'}}))).status,403)});
 await test('Production admin retains DB-authorized caller and correct AI stopped state',async()=>{adminRole=true;env.AI_ENABLED='true';const r=await adminRoute.GET(new Request('https://minnade-tsukuru.vercel.app/api/admin',{headers:{authorization:'Bearer fixture'}}));assert.equal(r.status,200);assert.equal((await r.json()).detail.startup.ai,false)});
 await test('Production admin telemetry is independent of disabled payments',async()=>{calls=[];await admin.adminEvent('admin_denied');assert.deepEqual(calls,['v25_record_event'])});
 const map=require('./migrations.cjs').inventory();const applied=[...JSON.parse(fs.readFileSync('docs/release52-production-migrations.json')).migrations,...JSON.parse(fs.readFileSync('docs/buffer-production-migrations.json')).entries];
 await test('38 production-applied migration hashes unchanged locally',async()=>{assert.equal(applied.length,38);for(const a of applied){const m=map.find(x=>x.number===a.number);assert.equal(m.sha256,a.sha256);assert.equal(m.file,a.file)}});
 fs.writeFileSync('docs/v2-production-boundary-unit.json',JSON.stringify({complete:true,scope:'Local VM mocks; no network/production changes',checks:results,productionChanges:'NONE'},null,2)+'\n');console.log(JSON.stringify({complete:true,checks:results.length,network:0}));
 }catch(e){console.error(JSON.stringify({complete:false,passed:results.length,error:e.message}));process.exitCode=1}})();
