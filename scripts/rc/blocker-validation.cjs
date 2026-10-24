/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('fs'),cp=require('child_process');const ctx=require('../staging/safety.cjs').load();
const report={complete:false,checks:[],productionChanges:'NONE'};
const files=['lib/v2/environment.ts','lib/v2/server.ts','lib/billing/server.ts','lib/billing/deletion.ts','lib/admin/server.ts','lib/ai/provider.ts','lib/accountDeletionPreparation.ts','app/api/account/delete/route.ts','app/api/cron/account-deletion/route.ts','app/api/admin/route.ts','scripts/rc/production-boundary-unit.cjs','scripts/rc/owner-bootstrap-rehearsal.cjs','scripts/rc/free-deletion-rehearsal.cjs','scripts/rc/blocker-validation.cjs'];
const run=(name,args,env=process.env)=>{const r=cp.spawnSync(process.execPath,args,{env,encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:8e6});report.checks.push({name,pass:r.status===0});if(r.status!==0)throw Error(name);console.log('PASS '+name)};
try{
 run('typecheck',['node_modules/typescript/bin/tsc','--noEmit']);run('relevant-lint',['node_modules/eslint/bin/eslint.js',...files,'lib/legalVersions.ts','components/legal/TermsContent.tsx','components/legal/PrivacyContent.tsx','components/TermsConsentGate.tsx','scripts/rc/consent-059.cjs','scripts/rc/blocker-preview.cjs']);
 if (!process.argv.includes('--legal-only')) for(const file of ['scripts/rc/production-boundary-unit.cjs','scripts/rc/unit.cjs','scripts/billing/unit.cjs','scripts/ai/unit.cjs','docs/account-deletion-adapter-check.cjs','docs/account-deletion-db-check.cjs','docs/deletion-retention-check.cjs','docs/deletion-preflight-check.cjs'])run(file,[file]);
 const env={...process.env,...ctx.env,SUPABASE_URL:ctx.url,V2_ENABLED:'true',ADMIN_ENABLED:'true',V2_SCHEMA_VERSION:'58',AI_ENABLED:'true',AI_PROVIDER:'synthetic',OPENAI_API_KEY:'',NODE_OPTIONS:'',NEXT_TELEMETRY_DISABLED:'1',MVP_ACCOUNT_REQUESTS_ENABLED:'false',MVP_ACCOUNT_FINALIZE_ENABLED:'false'};
 for(const key of ['ATOMIC_CORE','ATOMIC_JOIN','DB_GUARDS','UPLOADS','ROOM_CREATION','DRAFTS','LIKE_REQUESTS','MEMBERSHIP_GUARDS','REPORT_INTAKE','REPORT_QUEUE','MODERATION','ACCOUNT_ATTRIBUTION'])env['MVP_'+key+'_ENABLED']='true';
 run('build',['node_modules/next/dist/bin/next','build','--webpack'],env);report.complete=true;
}catch(e){report.failedCheck=e.message;process.exitCode=1}
fs.writeFileSync(process.argv.includes('--legal-only')?'docs/v2-production-legal-validation.json':'docs/v2-production-blocker-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
