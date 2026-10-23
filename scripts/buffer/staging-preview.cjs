/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const {root}=require('./staging-context.cjs');
const P=require('../release/private.cjs');
const project='prj_Qo1OsPU4tdgA2fluqzbAr1kTk6Dy',org='team_h7mrKWyMEKj18SFte6OQzWZb',scope='sonetokiyas-projects';
const cli=fs.readFileSync(path.join(root,'.staging-private/vercel-cli-path.txt'),'utf8').trim();
const stateFile=path.join(P.privateDir,'buffer-staging-cron.aes'),key=P.encryptionKey();
const save=s=>P.writeEncrypted(stateFile,JSON.stringify(s),key);
const run=(args,input,cwd=root)=>{const r=cp.spawnSync(process.execPath,[cli,...args,'--scope',scope],{input,encoding:'utf8',windowsHide:true,cwd,timeout:180000,maxBuffer:8*1024*1024});if(r.status!==0)throw Error('VERCEL_'+args[0].toUpperCase()+'_FAILED');return r.stdout;};
(async()=>{
 const mode=process.argv[2];
 let s=fs.existsSync(stateFile)?JSON.parse(P.decrypt(fs.readFileSync(stateFile),key)):null;
 if(mode==='prepare'){
  if(s)throw Error('ALREADY_PREPARED');
  const metadata=JSON.parse(run(['api','/v9/projects/'+project]));
  if(metadata.id!==project||metadata.name!=='minnade-tsukuru-staging')throw Error('STAGING_PROJECT_MISMATCH');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'minnade-buffer-staging-'));
  for(const name of ['app','components','lib','public'])if(fs.existsSync(path.join(root,name)))fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true});
  for(const name of ['package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','middleware.ts'])if(fs.existsSync(path.join(root,name)))fs.copyFileSync(path.join(root,name),path.join(dir,name));
  fs.mkdirSync(path.join(dir,'.vercel'));fs.writeFileSync(path.join(dir,'.vercel/project.json'),JSON.stringify({projectId:project,orgId:org}));
  fs.writeFileSync(path.join(dir,'vercel.json'),JSON.stringify({framework:'nextjs',crons:[]}));
  s={dir,cronSecret:crypto.randomBytes(32).toString('hex'),bypass:crypto.randomBytes(16).toString('hex'),preparedAt:new Date().toISOString()};save(s);
  console.log(JSON.stringify({prepared:true,project,sourceContainsEnv:false,productionChanged:false}));
 }else if(mode==='configure'){
  if(!s)throw Error('PREPARE_REQUIRED');
  for(const [name,value]of Object.entries({BUFFER_CRON_SECRET:s.cronSecret,BUFFER_RUN_MODE:'dry-run',STAGING_TEST:'true'}))run(['env','add',name,'--environment','preview','--project',project,'--force','--yes','--sensitive'],value,s.dir);
  const bypassResult=JSON.parse(run(['api','/v1/projects/'+project+'/protection-bypass','--method','PATCH','--input','-'],JSON.stringify({generate:{secret:s.bypass,note:'Buffer staging cron acceptance'}})));
  if(!bypassResult.protectionBypass?.[s.bypass])throw Error('BYPASS_NOT_CONFIRMED');
  s.configured=true;save(s);console.log(JSON.stringify({configured:true,environment:'preview',automatic:'OFF',project,productionChanged:false}));
 }else if(mode==='deploy'){
  if(!s?.configured)throw Error('CONFIGURE_REQUIRED');
  const out=run(['deploy','--yes','--no-wait'],undefined,s.dir);
  const urls=out.match(/https:\/\/minnade-tsukuru-staging[-a-z0-9]*\.vercel\.app/g);if(!urls?.length)throw Error('DEPLOYMENT_URL_MISSING');
  s.url=urls.at(-1);save(s);console.log(JSON.stringify({url:s.url,production:false}));
 }else if(mode==='inspect'){
  if(!s?.url)throw Error('DEPLOYMENT_REQUIRED');
  const d=JSON.parse(run(['api','/v13/deployments/'+new URL(s.url).hostname]));
  console.log(JSON.stringify({url:s.url,id:d.id,readyState:d.readyState,target:d.target,projectId:d.projectId}));
 }else if(mode==='smoke'){
  if(!s?.url)throw Error('DEPLOYMENT_REQUIRED');
  const request=async(auth)=>{const r=await fetch(s.url+'/api/cron/buffer',{headers:{'x-vercel-protection-bypass':s.bypass,...auth?{authorization:'Bearer '+s.cronSecret}:{}},redirect:'error',signal:AbortSignal.timeout(60000)});let b;try{b=await r.json()}catch{b={code:'NON_JSON'}}return {status:r.status,mode:b.mode,code:b.code,writes:b.writes,sends:b.sends};};
  const unauthorized=await request(false),overlap=await Promise.all([request(true),request(true)]);
  const result={checkedAt:new Date().toISOString(),url:s.url,unauthorized,overlap,productionChanged:false};
  fs.writeFileSync(path.join(root,'docs/buffer-staging-hosted-cron-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }else throw Error('INVALID_MODE');
})().catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'STAGING_PREVIEW_FAILED');process.exitCode=1});
