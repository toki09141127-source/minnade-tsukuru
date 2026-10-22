/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs=require('fs'),cp=require('child_process'),path=require('path'),os=require('os'),ctx=require('../staging/safety.cjs').load();
const project=JSON.parse(fs.readFileSync('.vercel/project.json'));if(project.projectId!=='prj_Qo1OsPU4tdgA2fluqzbAr1kTk6Dy'||project.projectName!=='minnade-tsukuru-staging')throw Error('PREVIEW_PROJECT_MISMATCH');
const cli=fs.readFileSync('.staging-private/vercel-cli-path.txt','utf8').trim();
const result={project:'minnade-tsukuru-staging',environment:'preview',updated:[],complete:false,productionChanges:'NONE'};
const values={NEXT_PUBLIC_SUPABASE_URL:ctx.url,NEXT_PUBLIC_SUPABASE_ANON_KEY:ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:ctx.env.SUPABASE_SERVICE_ROLE_KEY,SUPABASE_URL:ctx.url,V2_ENABLED:'true',STAGING_TEST:'true',STAGING_ENVIRONMENT:'staging',STAGING_EXPECTED_PROJECT_REF:ctx.ref,STAGING_SYNTHETIC_ONLY:'true',AI_PROVIDER:'openai',AI_MODEL:ctx.env.AI_MODEL,OPENAI_API_KEY:ctx.env.OPENAI_API_KEY,AI_ENABLED:'false',MVP_ACCOUNT_REQUESTS_ENABLED:'false',MVP_ACCOUNT_FINALIZE_ENABLED:'false'};
for(const f of ['ATOMIC_CORE','ATOMIC_JOIN','DB_GUARDS','UPLOADS','ROOM_CREATION','DRAFTS','LIKE_REQUESTS','MEMBERSHIP_GUARDS','REPORT_INTAKE','REPORT_QUEUE','MODERATION','ACCOUNT_ATTRIBUTION'])values['MVP_'+f+'_ENABLED']='true';
for(const [name,value] of (process.argv.includes('--source-only')?[]:Object.entries(values))){
 if(!value)throw Error('MISSING_'+name);
 const args=[cli,'env','add',name,'--environment','preview','--force','--yes','--scope','sonetokiyas-projects','--project',project.projectId];
 if(['OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY'].includes(name))args.push('--sensitive');else args.push('--no-sensitive');
 const r=cp.spawnSync(process.execPath,args,{input:value,encoding:'utf8',windowsHide:true,timeout:30000});
 if(r.status!==0){result.failed=name;let diagnostic=(r.stderr||'')+(r.stdout||'');for(const v of Object.values(ctx.env))if(v&&v.length>8)diagnostic=diagnostic.split(v).join('[REDACTED]');result.diagnostic=diagnostic.slice(-1000);fs.writeFileSync('docs/v2-2-preview-env.json',JSON.stringify(result,null,2)+'\n');throw Error('PREVIEW_ENV_FAILED_'+name)}
 result.updated.push(name);
}
if(!process.argv.includes('--source-only')){result.complete=true;fs.writeFileSync('docs/v2-2-preview-env.json',JSON.stringify(result,null,2)+'\n');}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'minnade-v22-preview-'));
for(const name of ['app','components','lib','public','eslint.config.mjs','middleware.ts','next-env.d.ts','next.config.ts','package-lock.json','package.json','postcss.config.mjs','tsconfig.json'])if(fs.existsSync(name))fs.cpSync(name,path.join(dir,name),{recursive:true});
fs.mkdirSync(path.join(dir,'.vercel'));fs.writeFileSync(path.join(dir,'.vercel/project.json'),JSON.stringify(project));
fs.writeFileSync(path.join(dir,'vercel.json'),JSON.stringify({framework:'nextjs',buildCommand:'npm run build',installCommand:'npm ci',crons:[]}));
fs.writeFileSync('.staging-private/v22-preview-dir.txt',dir);
console.log(JSON.stringify({configured:true,variables:result.updated.length,sourcePrepared:true,aiGenerationEnabled:false}));