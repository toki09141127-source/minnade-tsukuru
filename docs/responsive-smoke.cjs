/* eslint-disable @typescript-eslint/no-require-imports -- Loopback-only synthetic browser smoke. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),net=require('node:net'),{spawn}=require('node:child_process');
const runtime=process.env.MVP_TEST_RUNTIME;
if(!runtime)throw Error('MVP_TEST_RUNTIME_REQUIRED');
const {chromium}=require(path.join(runtime,'node_modules/playwright-core'));
(async()=>{
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const log=fs.openSync(path.join(__dirname,'acceptance-browser-server.txt'),'w');
 const server=spawn(process.execPath,['--require',path.join(__dirname,'audit-no-network.cjs'),'node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{cwd:path.resolve(__dirname,'..'),windowsHide:true,stdio:['ignore',log,log],env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',SUPABASE_URL:'https://example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'audit-placeholder',SUPABASE_SERVICE_ROLE_KEY:'audit-placeholder',CRON_SECRET:'audit-placeholder',NEXT_TELEMETRY_DISABLED:'1'}});
 let browser;const results=[];
 try{
  const base='http://127.0.0.1:'+port;
  let ready=false;for(let i=0;i<60;i++){try{const r=await fetch(base+'/login');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500));}
  assert.ok(ready,'Local server ready');
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext();
  await context.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===base?route.continue():route.abort()});
  const page=await context.newPage();
  for(const width of [320,375,390,768,1280]){
   await page.setViewportSize({width,height:900});
   for(const route of ['/','/login','/rooms','/rooms/create','/works','/profile','/moderation']){
    await page.goto(base+route,{waitUntil:'networkidle'});
    const layout=await page.evaluate(()=>({
     width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
     clipped:[...document.querySelectorAll('button,input,select,textarea')].filter(e=>{
      const r=e.getBoundingClientRect();return r.width>0&&(r.left < -1 || r.right>document.documentElement.clientWidth+1);
     }).map(e=>e.tagName)
    }));
    results.push({width,route,...layout,pass:layout.scroll<=width+1&&layout.clipped.length===0});
    if(width===320&&route==='/rooms/create')await page.screenshot({path:path.join(__dirname,'acceptance-room-create-320.png'),fullPage:true});
   }
  }
  fs.writeFileSync(path.join(__dirname,'responsive-smoke-results.json'),JSON.stringify(results,null,2));
  for(const result of results)console.log((result.pass?'PASS ':'FAIL ')+result.width+' '+result.route+' overflow='+Math.max(0,result.scroll-result.width)+' clipped='+result.clipped.length);
  assert.ok(results.every(r=>r.pass),'No horizontal overflow or clipped visible controls');
  console.log('Completed '+results.length+' anonymous responsive checks. Authenticated modals/uploads/real phones NOT verified.');
 }finally{
  if(browser)await browser.close();
  server.kill();await new Promise(r=>server.once('exit',r));fs.closeSync(log);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
