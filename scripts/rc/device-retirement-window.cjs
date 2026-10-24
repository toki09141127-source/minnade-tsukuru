/* eslint-disable @typescript-eslint/no-require-imports -- One authorized disposable staging account; bounded operational window. */
const fs=require('fs'),assert=require('node:assert/strict'),{randomUUID}=require('crypto'),{createClient}=require('@supabase/supabase-js');
const stopFile='.staging-private/v2-device-retirement.stop',lockFile='.staging-private/v2-device-retirement.lock';
const privateFile='.staging-private/v2-device-retirement.json',proofFile='docs/v2-final-device-retirement-window.json';
const cookieFile='.staging-private/v2rc-preview-access.json';
const preview='https://minnade-tsukuru-staging-jrvv8pum3-sonetokiyas-projects.vercel.app';
if(process.argv.includes('--stop')){if(fs.existsSync(lockFile))fs.writeFileSync(stopFile,'stop');console.log(JSON.stringify({stopRequested:fs.existsSync(lockFile)}));}
else (async()=>{
 let db,guardDb,owner,rt,initial,target,otherBefore,locked=false,changed=false,stopping=false,polling=false,timer,endTimer;
 const out={active:false,device:'android',preview,productionChanges:'NONE',liveBilling:'OFF',automaticTargetRequest:false,automaticTargetClaim:false,rawLogsSaved:false};
 const save=()=>fs.writeFileSync(proofFile,JSON.stringify(out,null,2)+'\n');
 let finish;const finished=new Promise(resolve=>{finish=resolve;});
 const state=async()=>{const r=await owner.rpc('v25_admin_read',{p_section:'system'});assert.ok(!r.error&&r.data?.detail,'ADMIN_STATE');return r.data.detail;};
 const feature=async(name,value)=>{const d=await state();if(d.flags[name]===value)return;const r=await owner.rpc('v25_admin_action',{p_request:randomUUID(),p_action:'feature',p_type:'system',p_target:name,p_version:d.version,p_value:value,p_reason:'operational',p_note:'Bounded Android disposable RC retirement acceptance'});assert.ok(!r.error&&!r.data?.error,'AUDITED_FEATURE_CHANGE');};
 const otherJobs=async()=>(await db.query("SELECT count(*)::int count,md5(coalesce(string_agg(to_jsonb(j)::text,'|' ORDER BY id),'')) fingerprint FROM account_deletion_jobs j WHERE actor_id<>$1",[target.actor])).rows[0];
 const targetState=async()=>(await db.query("SELECT (SELECT count(*)::int FROM auth.users WHERE id=$1) auth_count,(SELECT stage FROM account_deletion_jobs WHERE actor_id=$1) stage,(SELECT lease_until>now() FROM account_deletion_jobs WHERE actor_id=$1) active_lease,(SELECT jsonb_build_object('ownerAbsent',owner_id IS NULL,'deleting',deleting,'confirmed',deletion_confirmed,'status',status) FROM billing_accounts WHERE id=$2) billing",[target.actor,target.account])).rows[0];
 const stop=async reason=>{
  if(stopping)return;stopping=true;clearInterval(timer);clearTimeout(endTimer);out.stopReason=reason;
  try{
   if(changed){await feature('deletion_intake',false);await feature('deletion_worker',false);const now=await state();out.flagsRestored=now.flags.deletion_intake===initial.deletion_intake&&now.flags.deletion_worker===initial.deletion_worker;out.intakeEnabled=now.flags.deletion_intake;out.workerEnabled=now.flags.deletion_worker;}
   if(target&&otherBefore){const after=await otherJobs();out.otherJobsUnchanged=after.fingerprint===otherBefore.fingerprint&&after.count===otherBefore.count;out.target=await targetState();}
  }catch{out.cleanupRequired=true;process.exitCode=1;}
  finally{
   // Restore the stop controls before releasing the locks protecting older jobs.
   if(guardDb){await guardDb.query('ROLLBACK').catch(()=>{});await guardDb.end().catch(()=>{});}
   if(rt){out.webhooks={...rt.counts};await rt.close().catch(()=>{out.cleanupRequired=true;});}
   if(owner)await owner.auth.signOut({scope:'local'}).catch(()=>{});
   if(db)await db.end().catch(()=>{});
   if(locked){for(const f of [cookieFile,stopFile,lockFile])if(fs.existsSync(f))fs.unlinkSync(f);}
   out.active=false;out.endedAt=new Date().toISOString();out.cookieFileRemoved=!fs.existsSync(cookieFile);save();
   console.log(JSON.stringify({active:false,reason,flagsRestored:out.flagsRestored,otherJobsUnchanged:out.otherJobsUnchanged,cleanupRequired:out.cleanupRequired||false}));finish();
  }
 };
 try{
  assert.ok(process.argv.includes('--start'),'START_REQUIRED');const {ctx,d}=require('./preview-scope.cjs').deployment();assert.equal(d.url,preview);const access=require('./preview-scope.cjs').access();
  assert.ok(!fs.existsSync('.staging-private/v2-final-device-forward.lock'),'PAYMENT_WINDOW_MUST_END');
  fs.writeFileSync(lockFile,String(process.pid),{flag:'wx'});locked=true;if(fs.existsSync(stopFile))fs.unlinkSync(stopFile);
  process.env.LOCALAPPDATA='C:/Users/Sonet/AppData/Local';db=(await require('../billing/db.cjs')()).db;await db.query('SET default_transaction_read_only=on');
  db.on('error',()=>void stop('READ_CONNECTION_FAILED'));
  const r=await db.query("SELECT u.id actor,b.id account,b.customer_id customer,b.subscription_id subscription FROM auth.users u JOIN billing_accounts b ON b.owner_id=u.id WHERE lower(u.email)=$1 AND b.provider='stripe_test' AND b.plan='plus' AND b.status='active' AND NOT b.deleting",['minnadetsukuru.auth+rcandroid@gmail.com']);assert.equal(r.rowCount,1,'EXACT_PAID_ANDROID_REQUIRED');target=r.rows[0];
  const checks=(await db.query("SELECT (SELECT count(*)::int FROM admin_users WHERE user_id=$1 AND active) staff,(SELECT count(*)::int FROM rooms WHERE created_by=$1 AND deleted_at IS NULL) rooms,(SELECT count(*)::int FROM posts WHERE user_id=$1) posts,(SELECT count(*)::int FROM attachment_uploads WHERE user_id=$1) uploads,(SELECT count(*)::int FROM account_deletion_jobs WHERE actor_id=$1) existing_jobs,(SELECT count(*)::int FROM account_deletion_jobs WHERE lease_until>now()) active_leases,(SELECT count(*)::int FROM mvp_private.deletion_effects e JOIN account_deletion_jobs j ON j.id=e.job_id WHERE e.state IN ('started','unknown') AND j.stage<>'completed') unresolved,(SELECT count(*)::int FROM cron.job WHERE active AND lower(command) LIKE '%account-deletion%') crons",[target.actor])).rows[0];assert.ok(Object.values(checks).every(v=>v===0),'RETIREMENT_PREFLIGHT');out.preflight=checks;
  initial=(await db.query('SELECT mvp_private.v25_flags() f')).rows[0].f;assert.equal(initial.ai,false);assert.equal(initial.deletion_intake,false);assert.equal(initial.deletion_worker,false);
  otherBefore=await otherJobs();out.protectedExistingJobs=otherBefore.count;
  assert.ok(!fs.existsSync(privateFile),'PRIOR_RETIREMENT_STATE_EXISTS');fs.writeFileSync(privateFile,JSON.stringify({projectRef:ctx.ref,preview,target,initial,otherBefore,createdAt:new Date().toISOString()}));
  const staff=JSON.parse(fs.readFileSync('.staging-private/v2rc-e2e.json'));owner=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});assert.ok(!(await owner.auth.signInWithPassword(staff.users[0])).error,'SYNTHETIC_OWNER_LOGIN');await state();
  guardDb=(await require('../billing/db.cjs')()).db;guardDb.on('error',()=>void stop('GUARD_CONNECTION_FAILED'));await guardDb.query('BEGIN');await guardDb.query('SELECT 1 FROM account_deletion_jobs WHERE actor_id<>$1 FOR UPDATE NOWAIT',[target.actor]);out.otherJobsRowLocked=true;
  rt=await require('./preview-listener.cjs')({allowEvent:async e=>e.livemode===false&&e.data?.object?.customer===target.customer});
  // No request/claim/worker invocation occurs here; only the person's actor-bound UI request may execute it.
  changed=true;await feature('deletion_worker',true);await feature('deletion_intake',true);
  const response=await fetch(preview+'/api/account/delete',{headers:{Cookie:rt.cookie},redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);assert.equal((await response.json()).enabled,true,'HOSTED_DELETION_NOT_READY');
  const duration=Math.min(20*60000,Date.parse(access.expiresAt)-Date.now()-60000);assert.ok(duration>5*60000,'WINDOW_TOO_SHORT');
  Object.assign(out,{active:true,startedAt:new Date().toISOString(),endsAt:new Date(Date.now()+duration).toISOString(),intakeEnabled:true,workerEnabled:true,workerCronInvoked:false});save();console.log(JSON.stringify({active:true,endsAt:out.endsAt,protectedExistingJobs:out.protectedExistingJobs,device:'android'}));
  timer=setInterval(async()=>{if(polling||stopping)return;polling=true;try{
   if(fs.existsSync(stopFile)){await stop('requested');return;}
   await guardDb.query('SELECT 1');const other=await otherJobs();if(other.fingerprint!==otherBefore.fingerprint||other.count!==otherBefore.count){await stop('OTHER_JOB_CHANGE');return;}
   const s=await targetState();out.target=s;out.webhooks={...rt.counts};save();
   const flags=(await db.query('SELECT mvp_private.v25_flags() f')).rows[0].f;if(!flags.deletion_worker||!flags.deletion_intake){await stop('OPERATOR_STOP');return;}
   if(s.stage==='completed'){await stop('target_completed');return;}
   if(s.stage==='needs_review'){await stop('target_needs_review');return;}
  }catch{await stop('SAFE_MONITOR_FAILURE');}finally{polling=false;}},5000);
  endTimer=setTimeout(()=>void stop('window_expired'),duration);
  process.once('SIGINT',()=>void stop('interrupted'));process.once('SIGTERM',()=>void stop('terminated'));
  await finished;
 }catch(error){out.failure=/^[A-Z_]+$/.test(error.message||'')?error.message:'SAFE_RETIREMENT_SETUP_FAILED';process.exitCode=1;await stop('SAFE_RETIREMENT_SETUP_FAILED');}
})();
