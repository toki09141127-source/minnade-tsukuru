/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs=require('fs'),vm=require('vm'),ts=require('typescript'),crypto=require('crypto'),assert=require('node:assert/strict');
const ctx=require('../staging/safety.cjs').load(),{createClient}=require('@supabase/supabase-js');
if(!ctx.env.OPENAI_API_KEY||ctx.env.AI_PROVIDER!=='openai')throw Error('STAGING_AI_KEY_REQUIRED');
const state=JSON.parse(fs.readFileSync('.staging-private/v22-e2e.json'));assert.equal(state.projectRef,ctx.ref);assert.equal(state.ready,true);
const evidence='docs/v2-2-real-ai-result.json';const old=fs.existsSync(evidence)?JSON.parse(fs.readFileSync(evidence)):null;
if(old?.complete){console.log('REAL_AI_ALREADY_VERIFIED');process.exit(0)}
let calls=old?.apiCalls||0;
const result={projectRef:ctx.ref,provider:'openai',model:ctx.env.AI_MODEL,apiCalls:calls,checks:old?.checks||[],complete:false,productionChanges:'NONE'};
const save=()=>fs.writeFileSync(evidence,JSON.stringify(result,null,2)+'\n');
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,...args)=>{
 const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(u.origin===ctx.url)return realFetch(input,...args);
 if(u.origin!=='https://api.openai.com'||u.pathname!=='/v1/responses')throw Error('NETWORK_BOUNDARY');
 if(calls>=5)throw Error('REAL_AI_CALL_BUDGET');
 result.apiCalls=++calls;save();return realFetch(input,...args);
};
const cache=new Map(),load=file=>{if(cache.has(file))return cache.get(file);const m={exports:{}};cache.set(file,m.exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>n==='@/lib/publicationSafety'?load('lib/publicationSafety.ts'):n==='./safety'?load('lib/ai/safety.ts'):n==='server-only'?{}:require(n),process:{env:ctx.env},fetch:(...a)=>globalThis.fetch(...a),AbortSignal,Date,Set,Error});cache.set(file,m.exports);return m.exports};
const {OpenAiProvider}=load('lib/ai/provider.ts'),provider=new OpenAiProvider(ctx.env.OPENAI_API_KEY,ctx.env.AI_MODEL);
(async()=>{try{
 const admin=createClient(ctx.url,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),client=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const u=state.users[2];assert.ok(!(await client.auth.signInWithPassword({email:u.email,password:u.password})).error,'AUTH');
 if(!state.realRoom){const r=await client.rpc('v2_create_room',{p_request:crypto.randomUUID(),p_title:'TEST V22 real provider '+state.runId.slice(0,8),p_description:'安全な架空の仲間と協力して物語を作るための検収用ルームです。',p_genre:'novel',p_deadline:new Date(Date.now()+86400000).toISOString(),p_capacity:10,p_ai:'assist',p_consent:'2026-10-22-v2.1'});assert.ok(!r.error,'CREATE');state.realRoom=r.data;fs.writeFileSync('.staging-private/v22-e2e.json',JSON.stringify(state))}
 for(const kind of (process.argv.includes('--diagnose')?['question']:['greeting','question','summarize','draft_assist'])){
  if(kind!=='greeting'){const q=await client.rpc('v22_ai_request',{p_room:state.realRoom,p_request:crypto.randomUUID(),p_kind:kind,p_text:'提供された架空のルーム説明だけを使い、決定事項を作らず整理してください。'});assert.ok(!q.error,'REQUEST')}
  let c;for(let wait=0;wait<30;wait++){c=await admin.rpc('v22_ai_claim',{p_room:state.realRoom});if(c.error||c.data)break;await new Promise(r=>setTimeout(r,5000))}assert.ok(!c.error&&c.data,'CLAIM');const task=c.data;
  let output=null,usage={},error=null,diagnostic=null;
  try{const r=await provider.generate(task);output=r.output;usage=r.usage}catch(e){diagnostic={httpStatus:e.httpStatus,providerCode:e.providerCode};error=['PROVIDER_QUOTA','PROVIDER_RATE','PROVIDER_TIMEOUT','UNSAFE_OUTPUT','INVALID_OUTPUT'].includes(e.code)?e.code:'PROVIDER_UNAVAILABLE'}
  const f=await admin.rpc('v22_ai_finish',{p_task:task.id,p_lease:task.lease,p_output:output,p_usage:usage,p_error:error});
  result.checks.push({kind,pass:!f.error&&f.data==='succeeded',status:f.error?'DB_ERROR':f.data,providerError:error,diagnostic,usage:{inputTokens:usage.inputTokens??0,outputTokens:usage.outputTokens??0,durationMs:usage.durationMs??0}});save();
  assert.ok(!f.error&&f.data==='succeeded','REAL_'+kind+'_'+(error||'DB_FAILURE'));
  console.log('PASS real OpenAI '+kind);
 }
 result.complete=!process.argv.includes('--diagnose');save();
 }catch(e){result.failure=String(e.message).slice(0,160);save();console.log(JSON.stringify({complete:false,apiCalls:result.apiCalls,failure:result.failure}));process.exitCode=1}
})();