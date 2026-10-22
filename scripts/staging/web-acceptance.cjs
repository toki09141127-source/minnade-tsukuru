/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {load}=require('./safety.cjs');
(async()=>{
 const c=load(),runtime=process.env.MVP_TEST_RUNTIME;
 if(!runtime)throw Error('RUNTIME_REQUIRED');
 const {chromium}=require(path.join(runtime,'node_modules/playwright-core'));
 const fixture=JSON.parse(fs.readFileSync(path.join(c.root,'docs/core-staging-result.json'),'utf8'));
 const privateFixture=JSON.parse(fs.readFileSync(path.join(c.root,'.staging-private',fixture.runId+'.json'),'utf8'));
 if(privateFixture.projectRef!==c.ref)throw Error('FIXTURE_TARGET_REJECTED');
 const user=privateFixture.credentials[0];
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const base='http://127.0.0.1:'+port,r={projectRef:c.ref,checks:[],blockers:[],complete:false};
 const log=fs.openSync(path.join(c.root,'.staging-private','web-server.log'),'w');
 const server=spawn(process.execPath,['--require',path.join(__dirname,'web-network.cjs'),'node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p',String(port)],{
  cwd:c.root,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,...c.env,NODE_OPTIONS:'',SUPABASE_URL:c.url,CRON_SECRET:'staging-unused-test-secret',NEXT_TELEMETRY_DISABLED:'1',
  MVP_ACCOUNT_REQUESTS_ENABLED:'false',MVP_ATOMIC_CORE_ENABLED:'true'}});
 let browser;
 const ok=name=>r.checks.push({name,status:'PASS'});
 try{
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/login')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}
  assert.ok(ready,'STAGING_WEB_NOT_READY');
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext();
  await context.route('**/*',route=>{const u=new URL(route.request().url());return [base,c.url].includes(u.origin)?route.continue():route.abort()});
  const page=await context.newPage();await page.goto(base+'/login');
  await page.locator('input[type=email]').fill(user.email);await page.locator('input[type=password]').fill('synthetic-invalid-password');
  await page.getByRole('button',{name:'ログイン',exact:true}).click();
  await page.getByText('メールアドレス or パスワードが違います。',{exact:false}).waitFor();ok('Web rejects invalid password');
  await page.locator('input[type=password]').fill(user.password);
  const response=page.waitForResponse(x=>x.url().startsWith(c.url+'/auth/v1/token')&&x.request().method()==='POST');
  await page.getByRole('button',{name:'ログイン',exact:true}).click();
  assert.equal((await response).status(),200);ok('Web synthetic login reaches staging Auth successfully');
  await page.waitForURL(base+'/');
  await page.reload();ok('Authenticated browser reload completes');
  for(const width of [320,375,390,768,1280]){
   await page.setViewportSize({width,height:900});
   await page.goto(base+'/profile',{waitUntil:'networkidle'});
   const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);
   if(noOverflow)ok('Authenticated profile viewport '+width);else r.blockers.push({flow:'profile layout',width});
  }
  r.blockers.push({flow:'Major authenticated Web flows',reason:'Staging client ACL denies profiles, room_members and rooms_with_counts_v2; isolated REST prerequisite checks recorded separately'});
  r.complete=true;r.majorFlowsPassed=false;
 }catch(e){r.failure={code:e.name==='AssertionError'?'ASSERTION_FAILED':e.name};process.exitCode=1;}
 finally{
  if(browser)await browser.close();server.kill();await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,5000)});
  fs.closeSync(log);r.serverStopped=server.exitCode!==null||server.signalCode!==null;fs.writeFileSync(path.join(c.root,'docs/staging-web-result.json'),JSON.stringify(r,null,2));
  console.log(JSON.stringify(r,null,2));
 }
})();
