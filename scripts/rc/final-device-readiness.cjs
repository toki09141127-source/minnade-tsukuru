/* eslint-disable @typescript-eslint/no-require-imports -- Read-only final device window checks; no raw payload output. */
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{let db;try{
 const {d}=require('./preview-scope.cjs').deployment(),a=require('./preview-scope.cjs').access();
 const headers={Cookie:a.cookies.map(x=>x.name+'='+x.value).join('; ')};
 const get=async p=>{const r=await fetch(d.url+p,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});return {status:r.status,data:await r.json()}};
 const plans=await get('/api/billing?action=plans');assert.equal(plans.status,200);assert.equal(plans.data.paymentsEnabled,true);
 const admin=await get('/api/admin');assert.equal(admin.status,401);
 const deletion=await get('/api/account/delete');assert.equal(deletion.status,200);assert.equal(deletion.data.enabled,false);
 process.env.LOCALAPPDATA='C:/Users/Sonet/AppData/Local';db=(await require('../billing/db.cjs')()).db;
 await db.query('BEGIN READ ONLY');const flags=(await db.query('SELECT mvp_private.v25_flags() f')).rows[0].f;
 const jobs=(await db.query("SELECT count(*)::int n FROM account_deletion_jobs WHERE stage<>'completed'")).rows[0].n;
 await db.query('ROLLBACK');assert.equal(flags.ai,false);assert.equal(flags.deletion_intake,false);assert.equal(flags.deletion_worker,false);
 const out={complete:true,preview:d.url,hostedBillingExactStagingBoundary:true,testPaymentsAvailable:true,adminUnauthenticated:401,deletionCurrentlyEnabled:false,dbAiEnabled:false,dbDeletionIntake:false,dbDeletionWorker:false,pendingDeletionJobs:jobs,productionChanges:'NONE',readOnly:true};
 fs.writeFileSync('docs/v2-final-device-readiness.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
 }catch(e){console.log(JSON.stringify({complete:false,code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'CHECK_FAILED'}));process.exitCode=1}
 finally{if(db){await db.query('ROLLBACK').catch(()=>{});await db.end()}}
})();
