/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict'),ctx=require('../staging/safety.cjs').load(),{createClient}=require('@supabase/supabase-js');
const d=JSON.parse(fs.readFileSync('docs/v2-2-preview-deployment.json')),f='.staging-private/v22-e2e.json',s=JSON.parse(fs.readFileSync(f));
if(d.target!=='preview'||d.state!=='READY'||d.project!=='minnade-tsukuru-staging'||s.projectRef!==ctx.ref)throw Error('STAGING_PREVIEW_REQUIRED');
const access=JSON.parse(fs.readFileSync('.staging-private/v22-preview-access.json'));assert.equal(access.url,d.url);const cookie=access.cookies.map(c=>c.name+'='+c.value).join('; ');
const base=d.url,allowed=new Set([base,ctx.url]),original=globalThis.fetch;
globalThis.fetch=(input,options={})=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!allowed.has(url.origin))throw Error('NETWORK_SCOPE');return original(input,{...options,headers:{...options.headers,...(url.origin===base?{Cookie:cookie}:{})},signal:options.signal??AbortSignal.timeout(25000)});};
const out={scope:'hosted staging Preview; synthetic users/data; AI generation OFF',url:base,checks:[],complete:false,realAiVerified:false,productionChanges:'NONE'},save=()=>fs.writeFileSync('docs/v2-2-preview-result.json',JSON.stringify(out,null,2)+'\n'),ok=name=>{out.checks.push({name,pass:true});save();console.log('PASS '+name)};
let browser,phase='setup';
(async()=>{try{
 const client=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),login=await client.auth.signInWithPassword({email:s.users[0].email,password:s.users[0].password});assert.ok(!login.error);let token=login.data.session.access_token;
 const api=async(route,body,auth=true)=>{const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(auth?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
 const loginPage=await fetch(base+'/login');assert.equal(loginPage.status,200);assert.ok((await loginPage.text()).includes('メールアドレス'),'PREVIEW_PROTECTION_REQUIRES_AUTHENTICATED_ACCESS');ok('Hosted application login page verified');
 let ai=await api('/api/v2/ai?roomId='+s.rooms.assist);assert.equal(ai.status,200);assert.equal(ai.body.enabled,false);assert.ok(ai.body.outputs.some(o=>o.kind==='summarize'));ok('Stored synthetic AI summary remains readable while OFF');
 assert.equal((await api('/api/v2/ai',{roomId:s.rooms.assist,requestId:crypto.randomUUID(),kind:'question',text:'検収用の質問です'},false)).status,401);ok('Anonymous invocation rejected');
 assert.equal((await api('/api/v2/ai',{roomId:s.rooms.assist,requestId:crypto.randomUUID(),kind:'question',text:'検収用の質問です'})).status,503);ok('Hosted AI OFF rejects manual generation');
 assert.equal((await api('/api/v2/ai?roomId='+s.rooms.assist)).body.tasks.length,ai.body.tasks.length);ok('OFF invocation and state polling create no new tasks');
 phase='human creation';const creator=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const creatorLogin=await creator.auth.signInWithPassword({email:s.users[3].email,password:s.users[3].password});assert.ok(!creatorLogin.error);token=creatorLogin.data.session.access_token;
 if(!s.previewDeadline){s.previewDeadline=new Date(Date.now()+86400000).toISOString();fs.writeFileSync(f,JSON.stringify(s));}if(!s.previewRequest){s.previewRequest=crypto.randomUUID();fs.writeFileSync(f,JSON.stringify(s));}
 if(!s.previewRoom){const created=await api('/api/v2/create',{requestId:s.previewRequest,title:'TEST V22 Hosted human fallback',description:'生成AIが停止中でも人間だけで共同制作を続けられることを確認する架空のテストです。',genre:'novel',capacity:10,deadline:s.previewDeadline,aiLevel:'assist',consent:true});assert.equal(created.status,200,'CREATE');s.previewRoom=created.body.data;fs.writeFileSync(f,JSON.stringify(s));}
 ok('Hosted room creation works with AI stopped');
 const p=await api('/api/posts/create',{roomId:s.previewRoom,content:'TEST Hosted human creation continues safely.',post_type:'log',requestId:crypto.randomUUID()});assert.equal(p.status,200,'POST');ok('Hosted human post succeeds during AI stop');
 const state=await api('/api/v2/state?roomId='+s.previewRoom),draft=await api('/api/v2/draft',{roomId:s.previewRoom,version:state.body.draft?.version??0,reviewed:true,blocks:[{id:'hosted-text',type:'text',text:'TEST Human-authored draft remains editable.'}]});assert.equal(draft.status,200,'DRAFT');ok('Hosted reviewed human draft save succeeds');
 const empty=await api('/api/v2/ai?roomId='+s.previewRoom);assert.ok(empty.body.tasks.every(t=>t.status==='skipped'));assert.equal(empty.body.outputs.length,0);ok('Stopped room skips greeting without generating AI output');
 phase='public work';const work=await api('/api/v2/work?roomId='+s.extra.publication,undefined,false);assert.equal(work.status,200);assert.equal(work.body.contains_ai_assistance,true);assert.equal(work.body.aiAssistance,null);ok('Published Work disclosure persists; hidden AI text stays absent');
 const log=await api('/api/v2/log?roomId='+s.extra.publication,undefined,false);assert.equal(log.status,200);ok('Public production log API remains readable');
 const cron=await fetch(base+'/api/cron/ai');assert.ok([401,503].includes(cron.status));ok('Unauthenticated hosted AI scheduler is denied');
 phase='responsive UI';const {chromium}=require(path.join(ctx.env.MVP_TEST_RUNTIME,'node_modules/playwright-core'));browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext();await context.addCookies(access.cookies);const page=await context.newPage();await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());await page.goto(base+'/login');await page.locator('input[type=email]').fill(s.users[0].email);await page.locator('input[type=password]').fill(s.users[0].password);await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL(base+'/',{timeout:30000});ok('Hosted browser password login succeeds');
 await page.goto(base+'/rooms/'+s.rooms.assist);await page.getByText('AIは現在停止中です。人間の投稿・ドラフト編集は続けられます。',{exact:true}).waitFor({timeout:30000});
 for(const width of [320,375,390,1280]){
  await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'AIまとめ',exact:true}).click();await page.getByRole('heading',{name:'人間が明示した決定事項',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  assert.ok(await page.getByRole('button',{name:'AIに依頼する',exact:true}).isDisabled());
  await page.getByRole('button',{name:'AI発言・履歴',exact:true}).click();assert.ok(await page.getByText('AI Creator · AI',{exact:true}).first().isVisible());
  await page.getByRole('button',{name:'AIまとめ',exact:true}).click();await page.screenshot({path:'.staging-private/v22-preview-'+width+'.png'});ok('Hosted AI summary/messages/stopped UI fits '+width);
 }
 await page.goto(base+'/works/'+s.extra.publication);await page.getByText('AIの整理・提案を含む作品です。採用・制作は人間が行っています。',{exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'← 完成作品一覧',exact:true}).count(),1);ok('Hosted Work disclosure and return link are separate');
 await page.getByRole('link',{name:'この作品ができるまで',exact:true}).click();await page.getByRole('heading',{name:'公開制作ログ',exact:true}).waitFor();await page.getByRole('heading',{name:'AI Creator AI',exact:true}).waitFor();ok('Hosted Work opens public human/AI production log');
 out.complete=true;save();
}catch(e){out.failure={phase,code:String(e.code||'CHECK_FAILED'),message:String(e.message).replace(/https?:\/\/\S+/g,'[URL]').slice(0,160)};save();console.log(JSON.stringify(out.failure));process.exitCode=1}
finally{if(browser)await browser.close()}})();