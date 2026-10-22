/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {createClient}=require('@supabase/supabase-js'),{load}=require('./safety.cjs');
(async()=>{
 const c=load(),runtime=process.env.MVP_TEST_RUNTIME;if(!runtime)throw Error('RUNTIME_REQUIRED');
 const {chromium}=require(path.join(runtime,'node_modules/playwright-core'));
 const admin=createClient(c.url,c.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const resume=process.env.MVP_WEB_RESUME==='true';
 const prior=resume?JSON.parse(fs.readFileSync(path.join(c.root,'docs/web-full-staging-result.json'),'utf8')):null;
 if(prior)assert.equal(prior.projectRef,c.ref);
 const run=prior?.runId||crypto.randomUUID(),r=prior||{runId:run,projectRef:c.ref,checks:[],failures:[],complete:false};
 const creds=resume?JSON.parse(fs.readFileSync(path.join(c.root,'.staging-private',run+'.json'),'utf8')).credentials:[];
 r.serverStopped=false;
 if(resume){r.previousFailures=r.failures;r.failures=[];r.complete=false;}
 const save=()=>{fs.writeFileSync(path.join(c.root,'.staging-private',run+'.json'),JSON.stringify({runId:run,projectRef:c.ref,credentials:creds}));fs.writeFileSync(path.join(c.root,'docs/web-full-staging-result.json'),JSON.stringify(r,null,2))};
 const ok=name=>{r.checks.push({name,status:'PASS'});save();console.log('PASS '+name)};
 let phase='seed',browser,server,log;
 try{
  for(let i=0;!resume&&i<2;i++){
   const email='web-'+i+'-'+run+'@example.invalid',password=crypto.randomBytes(32).toString('base64url');
   const x=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{synthetic:true,test_run:run}});assert.ok(!x.error,'AUTH_SEED');
   creds.push({id:x.data.user.id,email,password});save();
  }
  const bucket=await admin.storage.getBucket('room_uploads');
  if(bucket.error){assert.ok(['404','400'].includes(String(bucket.error.statusCode)),'BUCKET_LOOKUP');assert.ok(!(await admin.storage.createBucket('room_uploads',{public:false,fileSizeLimit:4000000,allowedMimeTypes:['image/png','image/jpeg','image/gif','image/webp','video/mp4','video/webm','application/pdf','text/plain']})).error,'BUCKET_CREATE')}
  else assert.equal(bucket.data.public,false,'PRIVATE_BUCKET_REQUIRED');
  const listener=net.createServer();await new Promise(a=>listener.listen(0,'127.0.0.1',a));const port=listener.address().port;await new Promise(a=>listener.close(a));const base='http://127.0.0.1:'+port;
  log=fs.openSync(path.join(c.root,'.staging-private','web-full-server.log'),'w');
  server=spawn(process.execPath,['--require',path.join(__dirname,'web-network.cjs'),'node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p',String(port)],{cwd:c.root,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,...c.env,NODE_OPTIONS:'',SUPABASE_URL:c.url,CRON_SECRET:'staging-local-e2e',NEXT_TELEMETRY_DISABLED:'1',
   MVP_ACCOUNT_REQUESTS_ENABLED:process.env.MVP_WEB_DELETION==='true'?'true':'false',MVP_ACCOUNT_FINALIZE_ENABLED:process.env.MVP_WEB_DELETION==='true'?'true':'false',MVP_ATOMIC_CORE_ENABLED:'true',MVP_ATOMIC_JOIN_ENABLED:'true',MVP_DB_GUARDS_ENABLED:'true',MVP_UPLOADS_ENABLED:'true',MVP_ROOM_CREATION_ENABLED:'true',MVP_DRAFTS_ENABLED:'true',MVP_LIKE_REQUESTS_ENABLED:'true',MVP_MEMBERSHIP_GUARDS_ENABLED:'true',MVP_REPORT_INTAKE_ENABLED:'true',MVP_REPORT_QUEUE_ENABLED:'true',MVP_MODERATION_ENABLED:'true',MVP_ACCOUNT_ATTRIBUTION_ENABLED:'true'}});
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/login')).ok){ready=true;break}}catch{}await new Promise(a=>setTimeout(a,500))}assert.ok(ready,'SERVER_READY');
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const makePage=async()=>{
   const ctx=await browser.newContext();await ctx.route('**/*',route=>{const u=new URL(route.request().url());return [base,c.url].includes(u.origin)?route.continue():route.abort()});
   const p=await ctx.newPage();p.setDefaultTimeout(20000);p.on('pageerror',()=>{r.browserErrorCount=(r.browserErrorCount||0)+1});return p;
  };
  const response=async(p,route,action)=>{const promise=p.waitForResponse(x=>new URL(x.url()).pathname===route&&x.request().method()==='POST');await action();const res=await promise;assert.ok(res.ok(),'HTTP_'+route+'_'+res.status());return res.json()};
  const consent=async(p,button)=>{const dialog=p.getByRole('dialog');await dialog.waitFor();for(const checkbox of await dialog.getByRole('checkbox').all())await checkbox.check();await dialog.getByRole('button',{name:button,exact:true}).click();await dialog.waitFor({state:'hidden'})};
  const login=async(p,u)=>{await p.goto(base+'/login');await p.locator('input[type=email]').fill(u.email);await p.locator('input[type=password]').fill(u.password);await p.getByRole('button',{name:'ログイン',exact:true}).click();await p.waitForURL(base+'/');if(!resume)await consent(p,'同意して続ける')};
  const owner=await makePage(),member=await makePage();
  let room=r.room;const username='web'+run.slice(0,12).replaceAll('-','');
  if(!resume){
  phase='login-consent';await login(owner,creds[0]);ok('Owner Web login and self consent RPC');
  phase='profile';await owner.goto(base+'/profile');
  await owner.getByPlaceholder('例：あかさたな').fill(username);await owner.locator('textarea').fill('SYNTHETIC PUBLIC BIO');await owner.getByRole('button',{name:'保存',exact:true}).click();await owner.getByText('保存しました ✅',{exact:true}).waitFor();ok('Profile edit through authenticated service APIs');
  phase='create';await owner.goto(base+'/rooms/create');await owner.getByLabel('タイトル',{exact:true}).fill('SYNTHETIC WEB '+run.slice(0,8));await owner.getByLabel('制限時間（時間）',{exact:true}).fill('1');
  const created=await response(owner,'/api/rooms/create',()=>owner.getByRole('button',{name:'ルームを作成',exact:true}).click());room=created.room.id;r.room=room;save();await owner.waitForURL(base+'/rooms/'+room);await owner.getByLabel('制作ログの本文').waitFor();ok('Room creation and Creator membership visible');
  phase='room-list';await owner.goto(base+'/rooms');await owner.getByText('SYNTHETIC WEB '+run.slice(0,8),{exact:true}).waitFor();ok('Room listing works through safe view');
  phase='member-login';await login(member,creds[1]);ok('Member Web login and consent');
  phase='join';await member.goto(base+'/rooms/'+room);await member.getByRole('button',{name:'メンバー参加',exact:true}).click();await consent(member,'同意して進む');await member.getByLabel('制作ログの本文').waitFor();ok('Member join and room consent');
  phase='post-upload';await member.getByLabel('制作ログの本文').fill('SYNTHETIC WEB LOG');
  await member.getByLabel('添付ファイル（4MB以下）').last().setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('SYNTHETIC ATTACHMENT')});
  await response(member,'/api/posts/create',()=>member.getByRole('button',{name:'投稿する',exact:true}).click());await member.getByText('SYNTHETIC WEB LOG',{exact:true}).waitFor();ok('Web upload and post binding');
  phase='unread';await owner.goto(base+'/rooms/'+room);await owner.getByText('SYNTHETIC WEB LOG',{exact:true}).waitFor();
  const seen=await admin.from('room_members').select('last_seen_at').eq('room_id',room).eq('user_id',creds[0].id).single();assert.ok(!seen.error&&seen.data.last_seen_at);ok('Owner reads member post and last_seen is persisted');
  phase='core-request';await member.getByRole('button',{name:'コア申請（承認制）',exact:true}).click();await consent(member,'同意して進む');ok('Core request from active Member');
  phase='core-reject';await owner.reload();await response(owner,'/api/rooms/reject-core',()=>owner.getByRole('button',{name:'却下',exact:true}).click());ok('Creator rejects Core through UI');
  await member.reload();await member.getByRole('button',{name:'コア申請（承認制）',exact:true}).click();await consent(member,'同意して進む');
  phase='core-approve';await owner.reload();await response(owner,'/api/rooms/approve-core',()=>owner.getByRole('button',{name:'承認',exact:true}).click());ok('Creator approves Core through UI');
  if(process.env.MVP_WEB_DELETION==='true'){
   for(const [page,code] of [[owner,'UNPUBLISHED_CREATOR_ROOMS'],[member,'ACTIVE_CORE_ROOMS']]){
    await page.goto(base+'/profile');await page.getByLabel('保持と名義について確認しました').check();
    const pending=page.waitForResponse(x=>new URL(x.url()).pathname==='/api/account/delete'&&x.request().method()==='POST');
    await page.getByRole('button',{name:'退会を申請する',exact:true}).click();const denied=await pending;
    assert.equal(denied.status(),409);assert.equal((await denied.json()).code,code);ok('Web withdrawal refusal '+code);
   }
   await owner.goto(base+'/rooms/'+room);
  }
  phase='draft';await owner.getByRole('heading',{name:'完成作品ドラフト',exact:true}).waitFor();
  await owner.getByLabel('本文',{exact:true}).fill('SYNTHETIC FINISHED WORK');
  await owner.getByLabel('個人情報・権利と公開内容を確認しました').check();
  await response(owner,'/api/works/draft',()=>owner.getByRole('button',{name:'ドラフトを保存',exact:true}).click());ok('Work draft saved');
  phase='log-review';owner.once('dialog',d=>d.accept());await response(owner,'/api/posts/publication',()=>owner.getByRole('button',{name:'確認済みとして公開対象にする',exact:true}).click());ok('Synthetic log reviewed for publication');
  phase='publish';assert.ok(!(await admin.from('rooms').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',room)).error);
  const published=await fetch(base+'/api/cron/publish',{headers:{Authorization:'Bearer staging-local-e2e'}});assert.ok(published.ok);assert.ok((await fetch(base+'/api/cron/publish',{headers:{Authorization:'Bearer staging-local-e2e'}})).ok);ok('HTTP cron and retry publish once');
  }else{await login(owner,creds[0]);}
  if(process.env.MVP_WEB_FINAL_ONLY!=='true'){
  phase='works';await owner.goto(base+'/works');await owner.getByText('SYNTHETIC WEB '+run.slice(0,8),{exact:true}).waitFor();await owner.goto(base+'/works/'+room);await owner.getByText('SYNTHETIC FINISHED WORK',{exact:true}).waitFor();ok('Published work list and detail');
  phase='like';await owner.goto(base+'/rooms/'+room);await response(owner,'/api/rooms/like',()=>owner.getByRole('button',{name:'♡ いいね',exact:true}).click());await owner.getByRole('button',{name:'❤️ 済み',exact:true}).waitFor();ok('Published work like');
  phase='report';await owner.getByRole('button',{name:'通報',exact:true}).click();
  await owner.getByLabel('通報の詳細').fill('SYNTHETIC TEST REPORT');
  await response(owner,'/api/reports/create',()=>owner.getByRole('button',{name:'送信',exact:true}).click());
  await owner.getByText('通報を受け付けました（運営が確認します）',{exact:true}).waitFor();ok('Report accepted through Web UI');
  phase='public-profile';await owner.goto(base+'/u/'+username);await owner.getByText('SYNTHETIC PUBLIC BIO',{exact:true}).waitFor();ok('Public profile projection');
  phase='responsive';for(const width of [320,375,390]){await owner.setViewportSize({width,height:900});for(const route of ['/profile','/rooms','/rooms/create','/rooms/'+room,'/works','/works/'+room]){await owner.goto(base+route,{waitUntil:'networkidle'});const fits=await owner.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);if(fits)ok('Authenticated layout '+width+' '+route.replace(room,':room'));else r.failures.push({phase:'layout',width,route:route.replace(room,':room')})}}
  phase='report-layout';await owner.goto(base+'/rooms/'+room);
  await owner.getByRole('button',{name:'通報',exact:true}).click();
  for(const width of [320,375,390]){await owner.setViewportSize({width,height:900});assert.ok(await owner.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));ok('Report form layout '+width)}
  phase='logout';await owner.getByRole('button',{name:'ログアウト',exact:true}).click();await owner.waitForURL(base+'/');await owner.getByRole('link',{name:'ログイン',exact:true}).waitFor();ok('Web logout');
  }else{await owner.getByRole('button',{name:'ログアウト',exact:true}).click();await owner.waitForURL(base+'/');}
  phase='anonymous-work';await owner.goto(base+'/works/'+room);await owner.getByText('SYNTHETIC FINISHED WORK',{exact:true}).waitFor();ok('Anonymous published work detail');
  phase='public-attachment';const attachment=owner.getByRole('link',{name:'添付ファイルを開く',exact:true});await attachment.waitFor();
  const signedUrl=await attachment.getAttribute('href');assert.equal(new URL(signedUrl).origin,c.url);
  const content=await fetch(signedUrl);assert.ok(content.ok);assert.equal(await content.text(),'SYNTHETIC ATTACHMENT');ok('Published attachment signed URL serves exact synthetic bytes');
  if(process.env.MVP_WEB_DELETION==='true'){
   phase='deletion-ui';
   await owner.goto(base+'/login');await owner.locator('input[type=email]').fill(creds[0].email);await owner.locator('input[type=password]').fill(creds[0].password);await owner.getByRole('button',{name:'ログイン',exact:true}).click();await owner.waitForURL(base+'/');
   for(const [page,user] of [[member,creds[1]],[owner,creds[0]]]){
    await page.goto(base+'/profile');await page.getByLabel('保持と名義について確認しました').check();
    const done=await response(page,'/api/account/delete',()=>page.getByRole('button',{name:'退会を申請する',exact:true}).click());
    assert.equal(done.completed,true);assert.equal(done.state,'completed');
    await page.getByText('退会が完了しました。共同作品と制作履歴は匿名の名義で保持されます。',{exact:true}).waitFor();
    assert.equal((await admin.auth.admin.getUserById(user.id)).error?.code,'user_not_found');ok('Web confirmed Auth deletion '+(user===creds[0]?'Creator':'published Core'));
   }
   await owner.goto(base+'/works/'+room);await owner.getByText('SYNTHETIC FINISHED WORK',{exact:true}).waitFor();ok('Anonymous work survives both Web withdrawals');
   const retainedUrl=await owner.getByRole('link',{name:'添付ファイルを開く',exact:true}).getAttribute('href');
   assert.equal(await (await fetch(retainedUrl)).text(),'SYNTHETIC ATTACHMENT');ok('Public attachment survives both Web withdrawals');
  }
  await owner.setViewportSize({width:1280,height:900});
  await owner.screenshot({path:path.join(c.root,'docs/finishing-web-proof.png'),fullPage:true});
  r.complete=r.failures.length===0;
  if(r.browserErrorCount)r.failures.push({phase:'browser',code:'PAGE_ERRORS',count:r.browserErrorCount});
  r.complete=r.failures.length===0;
 }catch(e){r.failures.push({phase,code:e.name,assertion:e.name==='AssertionError'?e.message:undefined});process.exitCode=1;}
 finally{if(browser)await browser.close();if(server){server.kill();await new Promise(a=>{if(server.exitCode!==null||server.signalCode!==null)return a();server.once('exit',a);setTimeout(a,5000)});r.serverStopped=server.exitCode!==null||server.signalCode!==null;}if(log!==undefined)fs.closeSync(log);save();console.log(JSON.stringify(r,null,2));}
})().catch(()=>{console.error('WEB_SETUP_FAILED');process.exitCode=1});

