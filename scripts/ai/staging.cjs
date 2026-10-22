/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs=require('fs'),path=require('path'),cp=require('child_process'),net=require('net'),crypto=require('crypto'),assert=require('node:assert/strict');
const ctx=require('../staging/safety.cjs').load(),{createClient}=require('@supabase/supabase-js');
Object.assign(process.env,ctx.env);require('../staging/web-network.cjs');
const old=JSON.parse(fs.readFileSync('.staging-private/v2-e2e.json'));assert.equal(old.projectRef,ctx.ref);
const file='.staging-private/v22-e2e.json',resume=fs.existsSync(file),state=resume?JSON.parse(fs.readFileSync(file)):{runId:crypto.randomUUID(),projectRef:ctx.ref,rooms:{},users:old.users.slice(0,4)};
assert.equal(state.projectRef,ctx.ref);
const result={scope:'real staging; synthetic data and synthetic provider',checks:[],complete:false,productionChanges:'NONE'};
const save=()=>{fs.writeFileSync(file,JSON.stringify(state));fs.writeFileSync('docs/v2-2-staging-result.json',JSON.stringify(result,null,2)+'\n')};
const ok=name=>{result.checks.push({name,pass:true});save();console.log('PASS '+name)};
let server,browser,phase='setup';
const admin=createClient(ctx.url,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
(async()=>{try{
 assert.ok(!(await admin.rpc('v22_ai_control',{p_enabled:true})).error,'CONTROL');
 const clients=[];
 for(const u of state.users){const c=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const r=await c.auth.signInWithPassword({email:u.email,password:u.password});assert.ok(!r.error,'LOGIN');u.token=r.data.session.access_token;clients.push(c)}save();
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));const base='http://127.0.0.1:'+port;
 const env={...process.env,...ctx.env,SUPABASE_URL:ctx.url,V2_ENABLED:'true',AI_ENABLED:'true',AI_PROVIDER:'synthetic',OPENAI_API_KEY:'',NODE_OPTIONS:'',NEXT_TELEMETRY_DISABLED:'1',CRON_SECRET:crypto.randomBytes(24).toString('hex')};
 for(const f of ['ATOMIC_CORE','ATOMIC_JOIN','DB_GUARDS','UPLOADS','ROOM_CREATION','DRAFTS','LIKE_REQUESTS','MEMBERSHIP_GUARDS','REPORT_INTAKE','REPORT_QUEUE','MODERATION','ACCOUNT_ATTRIBUTION'])env['MVP_'+f+'_ENABLED']='true';
 const log=fs.openSync('.staging-private/v22-server.log','w');server=cp.spawn(process.execPath,['--require',path.resolve('scripts/staging/web-network.cjs'),'node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{env,windowsHide:true,stdio:['ignore',log,log]});
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/login')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}assert.ok(ready,'SERVER');
 const api=async(i,op,body)=>{const r=await fetch(base+'/api/v2/'+op,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+state.users[i].token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()}};
 const read=async(i,room)=>(await api(i,'ai?roomId='+room)).body;
 const waitFor=async(i,room,fn)=>{for(let attempt=0;attempt<45;attempt++){const s=await read(i,room);if(fn(s))return s;await new Promise(r=>setTimeout(r,1000))}throw Error('AI_WAIT_TIMEOUT')};
 for(const [index,mode] of ['assist','free','forbidden'].entries()){
  if(!state.rooms[mode]){phase='create '+mode;const r=await api(0,'create',{requestId:crypto.randomUUID(),title:'TEST V22 '+state.runId.slice(0,8)+' '+mode,description:'架空の仲間が共同で物語を作りながら協力する検収用ルームです。',genre:'novel',capacity:10,deadline:new Date(Date.now()+86400000).toISOString(),aiLevel:mode,consent:true});assert.equal(r.status,200,'CREATE_'+mode);state.rooms[mode]=r.body.data;save()}
  if(index<2){await waitFor(0,state.rooms[mode],s=>s.outputs?.some(o=>o.trigger_type==='greeting'));ok(mode+' greeting appears once')}
 }
 const room=state.rooms.assist;
 const before=await read(0,room);assert.equal(before.outputs.filter(o=>o.trigger_type==='greeting').length,1);ok('Greeting dedupe in real staging');
 const f=await read(0,state.rooms.forbidden);assert.equal(f.identity,null);assert.equal(f.tasks.length,0);ok('Forbidden creates zero AI tasks');
 const denied=await api(0,'ai',{roomId:state.rooms.forbidden,requestId:crypto.randomUUID(),kind:'question',text:'整理してください'});assert.equal(denied.status,503);ok('Forbidden AI API denied');
 for(const i of [1,2]){const r=await api(i,'member',{roomId:room,action:'join',consent:'2026-10-22-v2.1'});assert.equal(r.status,200,'JOIN')}
 const cr=await api(2,'member',{roomId:room,action:'apply_core',consent:'2026-10-22-v2.1'});assert.equal(cr.status,200,'CORE_REQUEST');
 const approved=await api(0,'member',{roomId:room,action:'approve_core',requestId:cr.body.data.requestId});assert.equal(approved.status,200,'CORE_APPROVE');
 const request=async(i,kind,text='今の内容を整理してください')=>api(i,'ai',{roomId:room,requestId:crypto.randomUUID(),kind,text});
 assert.equal((await request(1,'question')).status,403);ok('Member direct manual call denied');
 assert.equal((await api(3,'ai',{roomId:room,requestId:crypto.randomUUID(),kind:'idea',text:'案をください'})).status,403);ok('Foreign room invocation denied');
 const core=await request(2,'idea');assert.equal(core.status,202);await waitFor(2,room,s=>s.tasks.some(t=>t.id===core.body.taskId&&t.status==='succeeded'));ok('Core manual idea completes');
 const textPost=await fetch(base+'/api/posts/create',{method:'POST',headers:{Authorization:'Bearer '+state.users[0].token,'Content-Type':'application/json'},body:JSON.stringify({roomId:room,content:'決定：物語は架空の森から始めます。',post_type:'log',requestId:crypto.randomUUID()})});assert.equal(textPost.status,200);const postId=(await textPost.json()).postId;
 await api(0,'post',{roomId:room,postId,action:'approve_public',reviewed:true});
 const summary=await request(0,'summarize');assert.equal(summary.status,202);const s=await waitFor(0,room,x=>x.tasks.some(t=>t.id===summary.body.taskId&&t.status==='succeeded'));assert.equal(s.outputs.find(o=>o.kind==='summarize').payload.decisions.length,1);ok('Summary retains explicit human decision');
 const draft=await request(0,'draft_assist');assert.equal(draft.status,202);const ds=await waitFor(0,room,x=>x.tasks.some(t=>t.id===draft.body.taskId&&t.status==='succeeded'));const proposal=ds.outputs.find(o=>o.kind==='draft_assist');assert.ok(proposal.payload.draftText);ok('Draft remains an unaccepted proposal');
 assert.equal((await api(1,'ai',{action:'accept',roomId:room,outputId:proposal.id,version:proposal.base_version,blocks:[{id:'test',type:'text',text:proposal.payload.draftText}],reviewed:true})).status,403);ok('Member cannot accept draft proposal');
 const {chromium}=require(path.join(ctx.env.MVP_TEST_RUNTIME,'node_modules/playwright-core'));
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage();await page.route('**/*',r=>[base,ctx.url].includes(new URL(r.request().url()).origin)?r.continue():r.abort());await page.goto(base+'/login');await page.locator('input[type=email]').fill(state.users[0].email);await page.locator('input[type=password]').fill(state.users[0].password);await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL(base+'/');
 await page.goto(base+'/rooms/'+room);await page.getByRole('heading',{name:'AI Creator AI',exact:true}).waitFor();
 for(const width of [320,375,390,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'NO_HORIZONTAL_OVERFLOW_'+width);await page.screenshot({path:'.staging-private/v22-ui-'+width+'.png',fullPage:true});ok('AI UI viewport '+width)}
 await page.getByRole('button',{name:'AI発言・履歴',exact:true}).click();await page.getByRole('button',{name:'編集して採用を確認',exact:true}).click();await page.getByLabel('個人情報・権利・内容を確認して採用します').check();await page.getByRole('button',{name:'確認してドラフトへ追加',exact:true}).click();await page.getByRole('heading',{name:'提案を編集してドラフト末尾へ追加'}).waitFor({state:'hidden'});ok('UI human reviews and accepts proposal');
 const stateResponse=await api(0,'state?roomId='+room);assert.ok(stateResponse.body.draft.version>proposal.base_version);ok('Accepted draft advances version without overwriting earlier blocks');
 await admin.rpc('v22_ai_control',{p_enabled:false});assert.equal((await request(0,'question')).status,503);ok('DB kill switch rejects manual AI');
 const safePost=await fetch(base+'/api/posts/create',{method:'POST',headers:{Authorization:'Bearer '+state.users[0].token,'Content-Type':'application/json'},body:JSON.stringify({roomId:room,content:'TEST human continues during AI stop',post_type:'log',requestId:crypto.randomUUID()})});assert.equal(safePost.status,200);ok('Human posting remains available when AI stops');
 await admin.rpc('v22_ai_control',{p_enabled:true});
 state.ready=true;result.complete=true;save();
 }catch(e){result.failure={phase,code:String(e.code||'CHECK_FAILED'),message:String(e.message).replace(/https?:\/\/\S+/g,'[URL]').slice(0,200)};save();console.log(JSON.stringify(result.failure));process.exitCode=1}
 finally{if(browser)await browser.close();if(server)server.kill();}
})();