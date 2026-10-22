/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('fs'),path=require('path'),net=require('net'),{spawn}=require('child_process'),assert=require('assert/strict');
(async()=>{const root=path.resolve(__dirname,'../..'),s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));const base='http://127.0.0.1:'+port;
 const r={scope:'LOCAL HTTP ONLY; outbound networking disabled',base,checks:[],complete:false},save=()=>fs.writeFileSync('docs/contact-local-result.json',JSON.stringify(r,null,2));
 const log=fs.openSync('.staging-private/contact-local-server.log','w');
 const server=spawn(process.execPath,['--require','./docs/audit-no-network.cjs','node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{windowsHide:true,stdio:['ignore',log,log],env:{...process.env,NODE_OPTIONS:'',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',SUPABASE_URL:'https://example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-build-placeholder-not-a-key',SUPABASE_SERVICE_ROLE_KEY:'local-build-placeholder-not-a-key',CRON_SECRET:'local-smoke',MVP_DRAFTS_ENABLED:'false',MVP_UPLOADS_ENABLED:'false',MVP_ACCOUNT_ATTRIBUTION_ENABLED:'false'}});
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/login')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}assert.ok(ready);
  for(const page of ['/terms','/privacy','/login','/profile']){const x=await fetch(base+page),body=await x.text();assert.equal(x.status,200);assert.ok(body.includes('mailto:minnadetsukuru.auth@gmail.com')&&body.includes('<footer'));r.checks.push({name:page+' contact/footer renders',pass:true})}
  for(const route of ['/api/uploads','/api/storage/sign','/api/uploads/public/synthetic']){const x=await fetch(base+route,{method:route.includes('/public/')?'GET':'POST'});assert.equal(x.status,503);r.checks.push({name:route+' OFF is 503',pass:true})}
  const cron=await fetch(base+'/api/cron/publish',{headers:{authorization:'Bearer local-smoke'}});assert.equal(cron.status,503);r.checks.push({name:'cron OFF is 503 with valid secret',pass:true});
  r.complete=true;save();console.log('LOCAL_UI_READY '+base);
  const until=Date.now()+600000;while(Date.now()<until&&!fs.existsSync('.staging-private/contact-smoke-stop'))await new Promise(r=>setTimeout(r,500));
 }catch(e){r.failure=e.name;save();process.exitCode=1}finally{server.kill();await new Promise(resolve=>server.once('exit',resolve));fs.closeSync(log);r.serverStopped=true;save();console.log('LOCAL_UI_STOPPED')}
})().catch(()=>{console.error('LOCAL_CONTACT_FAILED');process.exitCode=1});
