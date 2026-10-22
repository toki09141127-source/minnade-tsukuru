/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('crypto'),ctx=require('../staging/safety.cjs').load(),{createClient}=require('@supabase/supabase-js');
Object.assign(process.env,ctx.env);require('../staging/web-network.cjs');
const s=JSON.parse(fs.readFileSync('.staging-private/v22-e2e.json'));assert.equal(s.projectRef,ctx.ref);
const result={scope:'real staging synthetic-only; exact fixture clock accelerated',checks:[],complete:false,productionChanges:'NONE'};
const save=()=>fs.writeFileSync('docs/v2-2-staging-automatic.json',JSON.stringify(result,null,2)+'\n');
const ok=name=>{result.checks.push({name,pass:true});save();console.log('PASS '+name)};
const cache=new Map(),load=file=>{if(cache.has(file))return cache.get(file);const m={exports:{}};cache.set(file,m.exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>n==='@/lib/publicationSafety'?load('lib/publicationSafety.ts'):n==='./safety'?load('lib/ai/safety.ts'):n==='server-only'?{}:require(n),process:{env:{}},Date,Set,Error});cache.set(file,m.exports);return m.exports};
const provider=new (load('lib/ai/provider.ts').SyntheticProvider)(),admin=createClient(ctx.url,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let phase='setup';
(async()=>{try{
 const clients=[];for(const u of s.users){const c=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});assert.ok(!(await c.auth.signInWithPassword({email:u.email,password:u.password})).error);clients.push(c)}
 const rpc=async(c,name,args)=>{const r=await c.rpc(name,args);assert.ok(!r.error,name+'_'+(r.error?.code||''));return r.data};
 const clock=(room,mode)=>rpc(admin,'v22_fixture_clock',{p_room:room,p_mode:mode});
 const read=(i,room)=>rpc(clients[i],'v22_ai_state',{p_room:room});
 const claim=room=>rpc(admin,'v22_ai_claim',{p_room:room});
 const finish=async(task,error=null)=>{const r=error?{output:null,usage:{}}:await provider.generate(task);return rpc(admin,'v22_ai_finish',{p_task:task.id,p_lease:task.lease,p_output:r.output,p_usage:r.usage,p_error:error})};
 const drain=async room=>{await clock(room,'ready');for(let n=0;n<8;n++){const t=await claim(room);if(!t)return;assert.equal(await finish(t),'succeeded');await clock(room,'ready')}throw Error('DRAIN_BOUND')};
 const post=async(i,room,text)=>{for(let n=0;n<3;n++){const r=await admin.rpc('create_post_with_upload',{p_actor:s.users[i].id,p_room:room,p_content:text,p_post_type:'log',p_upload:null,p_request_key:crypto.randomUUID()});if(!r.error)return r.data;if(r.error.message!=='RATE_LIMITED')throw Error('POST_'+r.error.code);console.log('Waiting for synthetic post rate window');await new Promise(r=>setTimeout(r,55000))}throw Error('POST_RATE')};
 await rpc(admin,'v22_ai_control',{p_enabled:true});
 const room=s.rooms.assist,free=s.rooms.free;
 phase='human thresholds';
 let ai=await read(0,room),thresholds=ai.tasks.filter(t=>t.trigger_type==='posts').length;
 while(thresholds<2){await post(0,room,'TEST automatic safe contribution');ai=await read(0,room);thresholds=ai.tasks.filter(t=>t.trigger_type==='posts').length;}
 await drain(room);ai=await read(0,room);assert.equal(ai.tasks.filter(t=>t.trigger_type==='posts'&&t.status==='succeeded').length,2);ok('Five and fifteen human posts produce exactly two summaries');
 const number=ai.tasks.length;await rpc(admin,'v22_ai_schedule',{});assert.equal((await read(0,room)).tasks.length,number);ok('AI responses cannot schedule an AI loop');
 phase='inactivity';await drain(free);await clock(free,'inactivity');await rpc(admin,'v22_ai_schedule',{});await rpc(admin,'v22_ai_schedule',{});await clock(free,'ready');
 let task=await claim(free);assert.equal(task.trigger,'inactivity');assert.equal(task.kind,'idea');await post(0,free,'TEST returning human');assert.equal(await finish(task),'skipped');ok('Free inactivity proposal cancelled when a human returns');
 phase='deadline';const pub=s.extra.publication,fallback=s.extra.fallback;
 await drain(pub);await drain(fallback);
 const p=await post(3,pub,'決定：共同作品の舞台は架空の島です。');
 await rpc(clients[3],'v2_post_action',{p_room:pub,p_post:p,p_action:'approve_public'});
 await clock(pub,'deadline');await rpc(admin,'v22_ai_schedule',{});await rpc(admin,'v22_ai_schedule',{});await clock(pub,'ready');
 task=await claim(pub);assert.equal(task.trigger,'deadline');assert.equal(await finish(task),'succeeded');ok('Deadline reminder once');
 phase='publication';await clock(pub,'expire');await rpc(admin,'v22_ai_schedule',{});await clock(pub,'ready');
 task=await claim(pub);assert.equal(task.trigger,'publication');assert.equal(await finish(task),'succeeded');
 const counts=await Promise.all([rpc(admin,'v22_publish_room',{p_room:pub}),rpc(admin,'v22_publish_room',{p_room:pub})]);assert.equal(counts.reduce((a,b)=>a+b,0),1);ok('Parallel bounded publication creates one snapshot');
 const anon=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 const snap=await anon.from('v2_work_snapshots').select('contains_ai_assistance,source_ai_output,incomplete').eq('room_id',pub).single();assert.ok(!snap.error&&snap.data.contains_ai_assistance&&snap.data.source_ai_output);ok('AI organization is disclosed on public work');
 assert.ok(await rpc(anon,'v22_ai_work',{p_room:pub}));ok('Public AI organization visible through safe boundary');
 await rpc(clients[3],'v22_ai_hide',{p_room:pub,p_output:snap.data.source_ai_output});assert.equal(await rpc(anon,'v22_ai_work',{p_room:pub}),null);ok('Moderation removes AI text from published work');
 phase='outage';await clock(fallback,'expire');await rpc(admin,'v22_ai_schedule',{});await clock(fallback,'ready');
 task=await claim(fallback);assert.equal(await finish(task,'PROVIDER_TIMEOUT'),'failed');
 await rpc(admin,'v22_ai_control',{p_enabled:false});
 assert.equal(await rpc(admin,'v22_publish_room',{p_room:fallback}),1);const f=await anon.from('v2_work_snapshots').select('contains_ai_assistance,incomplete').eq('room_id',fallback).single();assert.ok(!f.error&&!f.data.contains_ai_assistance&&f.data.incomplete);ok('Outage and AI OFF still publish incomplete human-only snapshot');
 await rpc(admin,'v22_ai_control',{p_enabled:true});const forbidden=await read(0,s.rooms.forbidden);assert.equal(forbidden.tasks.length,0);ok('Forbidden room remains zero tasks after every scheduler path');
 result.complete=true;save();
 }catch(e){result.failure={phase,message:String(e.message).slice(0,180)};save();console.log(JSON.stringify(result.failure));process.exitCode=1}
})();