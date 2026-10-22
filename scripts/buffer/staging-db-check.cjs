/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const {root,env,ctx,rpc,load,client}=require('./staging-context.cjs');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'docs/buffer-staging-fixture.json')));
const {planPromotions}=load(path.join(root,'lib/buffer/promotionPlanner.ts'));
const {runBuffer}=load(path.join(root,'lib/buffer/worker.ts'));
const {runTestCanary}=load(path.join(root,'lib/buffer/testCanary.ts'));
const checks=[],ok=(v,name)=>{assert.ok(v,name);checks.push({name,status:'PASS'});console.log('PASS '+name)};
async function call(n,a){const r=await rpc(n,a);if(r.error)throw Error('STAGING_RPC_'+(r.error.code||'FAILED'));return r.data}
async function main(){
 const s=await call('buffer_snapshot');
 ok(s.candidates.some(c=>c.targetId===fixture.canaryRoom&&c.kind==='completed'),'eligible completed source from real staging DB');
 ok(!s.candidates.some(c=>c.targetId===fixture.excludedRoom),'excluded real staging candidate absent');
 const relevant=s.candidates.filter(c=>c.kind!=='weekly');
 const tomorrow=new Date(new Date(s.now).getTime()+86400000).toISOString().slice(0,10)+'T01:00:00Z';
 const future=relevant.map(c=>({...c,snapshotAt:tomorrow}));
 const plan=planPromotions(future,[],tomorrow);
 ok(plan.length===2&&plan.every(p=>p.kind==='completed'),'real candidate inputs preserve completed priority and max two');
 const never={preflight:()=>{throw Error('NETWORK_FORBIDDEN')},send:()=>{throw Error('SEND_FORBIDDEN')}};
 const before=await call('buffer_snapshot');
 const dry=await runBuffer(rpc,never,'dry-run');
 const after=await call('buffer_snapshot');
 ok(JSON.stringify(before.history)===JSON.stringify(after.history)&&dry.writes===0&&dry.sends===0,'real-data dry-run does not change queue');
 const testDry=await runTestCanary(rpc,never,true);
 ok(testDry.eligible&&testDry.writes===0,'TEST canary dry-run validates exact planned slot');
 const enqueues=await Promise.all(Array.from({length:8},()=>call('buffer_reserve_test')));
 ok(enqueues.reduce((n,x)=>n+x,0)===1,'eight real PostgREST enqueues converge on one row');
 ok(await call('buffer_reserve_test')===0,'duplicate TEST enqueue denied');
 const claims=await Promise.all(Array.from({length:8},()=>call('buffer_claim',{p_event:'completed_'+fixture.dbTestRoom})));
 const q=claims.find(Boolean);
 ok(claims.filter(Boolean).length===1,'eight real PostgREST claims yield one winner');
 ok(await call('buffer_finish',{p_event:q.event_id,p_token:fixture.dbTestRoom,p_state:'unknown',p_code:'AMBIGUOUS'})===false,'stale fencing token denied');
 ok(await call('buffer_finish',{p_event:q.event_id,p_token:q.token,p_state:'failed',p_code:'PRECHECK_FAILED'})===true,'pre-send failed result persisted');
 ok(await call('buffer_claim',{p_event:q.event_id})===null,'retry backoff enforced in real DB');
 const anon=createClient(ctx.url,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 ok(!!(await anon.rpc('buffer_snapshot')).error,'anon RPC denied by real PostgREST');
 ok(!!(await client.from('buffer_queue').select('event_id')).error,'service role direct queue read denied');
 const result={projectRef:ctx.ref,checks,checkedAt:new Date().toISOString(),dryRun:dry,testDryRun:testDry,
 candidateMetadata:relevant.map(c=>({kind:c.kind,targetId:c.targetId})),timeNote:'Normal same-day slots have elapsed; priority tested with real candidates at next-day planning clock. TEST uses explicit short slot.',
 bufferMutations:0,productionConnected:false};
 fs.writeFileSync(path.join(root,'docs/buffer-staging-integration-result.json'),JSON.stringify(result,null,2)+'\n');
}
main().catch(e=>{console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'STAGING_INTEGRATION_FAILED');process.exitCode=1});
