/* eslint-disable @typescript-eslint/no-require-imports */
// Executes the production-configured adapter against only a staging SQL transaction.
// No Auth/Storage/provider API calls; all fixture changes rolled back.
const fs=require('fs'),assert=require('node:assert/strict');
const out={complete:false,checks:[],scope:'production Free adapter + actual staging schema, rollback only',productionChanges:'NONE',externalEffects:0};
const ok=name=>out.checks.push({name,pass:true});
(async()=>{let db,initial;try{
 process.env.LOCALAPPDATA='C:/Users/Sonet/AppData/Local';const x=await require('../billing/db.cjs')();db=x.db;assert.equal(x.ctx.ref,'fwqucffxdmbdczspkcyr');
 const f=JSON.parse(fs.readFileSync('.staging-private/v2rc-e2e.json'));assert.equal(f.projectRef,x.ctx.ref);
 const candidates=f.users.filter(u=>!['owner','moderator'].includes(u.label)).map(u=>u.id);
 const eligible=(await db.query("SELECT p.id FROM profiles p WHERE p.id=ANY($1::uuid[]) AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM admin_suspensions WHERE user_id=p.id AND suspended) AND NOT EXISTS(SELECT 1 FROM admin_users WHERE user_id=p.id) AND NOT EXISTS(SELECT 1 FROM account_deletion_jobs WHERE actor_id=p.id) AND NOT EXISTS(SELECT 1 FROM rooms WHERE created_by=p.id AND deleted_at IS NULL AND status<>'published') AND NOT EXISTS(SELECT 1 FROM room_members m JOIN rooms r ON r.id=m.room_id WHERE m.user_id=p.id AND m.role='core' AND m.left_at IS NULL AND r.status<>'published') AND NOT EXISTS(SELECT 1 FROM billing_accounts b WHERE b.owner_id=p.id AND (b.customer_id IS NOT NULL OR b.provider IS NOT NULL)) AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE owner=p.id OR owner_id=p.id::text) LIMIT 1",[candidates])).rows[0];assert.ok(eligible,'ELIGIBLE_SYNTHETIC_REQUIRED');const id=eligible.id;
 initial=(await db.query('SELECT mvp_private.v25_flags() f')).rows[0].f;
 await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='15s'");
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);
 await db.query("UPDATE mvp_private.admin_control SET flags=jsonb_set(flags,'{deletion_intake}','true') WHERE singleton");await db.query('SELECT mvp_set_deletion_pause(false)');
 const a=(await db.query('SELECT (mvp_private.v24_account($1)).id id',[id])).rows[0].id;
 await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
 const jid=(await db.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21') id",[id])).rows[0].id;
 const row=(await db.query('SELECT * FROM mvp_claim_deletion($1)',[jid])).rows[0];assert.ok(row?.lease_token);const job={id:jid,lease:row.lease_token,actorId:id,stage:row.stage};
 ok('Real intake and lease fence Free account; no external effects');
 const allowed=new Set(['v24_deletion_context','v24_deletion_confirm']);const client={rpc:async(name,args)=>{assert.ok(allowed.has(name));const keys=Object.keys(args);const r=await db.query('SELECT public.'+name+'('+keys.map((k,i)=>k+'=> $'+(i+1)+'::uuid').join(',')+') value',Object.values(args));return {data:r.rows[0].value,error:null}}};
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://joedeuyrzimqyjapqpyh.supabase.co',VERCEL_ENV:'production',V2_ENABLED:'false',V2_SCHEMA_VERSION:'58',BILLING_ENABLED:'false',AI_ENABLED:'false'});
 const prepare=require('../billing/load.cjs')('lib/billing/deletion.ts').prepareBillingDeletion;
 await prepare(client,job);await prepare(client,job);
 const state=(await db.query('SELECT deleting,deletion_confirmed,status FROM billing_accounts WHERE id=$1',[a])).rows[0];assert.ok(state.deleting&&state.deletion_confirmed&&state.status==='canceled');ok('Production Free/UI OFF adapter confirms once and replays safely on real schema');
 assert.equal((await db.query('SELECT count(*)::int n FROM profiles WHERE id=$1',[id])).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int n FROM auth.users WHERE id=$1',[id])).rows[0].n,1);ok('Billing confirmation precedes profile preparation and Auth removal');
 await db.query('SELECT mvp_prepare_deletion($1,$2)',[jid,job.lease]);const receipt=(await db.query('SELECT mvp_verify_deletion($1,$2) r',[jid,job.lease])).rows[0].r;assert.equal(receipt.actorId,id);for(const k of ['writesBlocked','retainedWorksVerified','attributionApplied','foreignKeysVerified','storageReadyForAuthDeletion'])assert.equal(receipt[k],true);ok('Actual V2 preparation preserves contribution/FK/Storage readiness contract');
 assert.equal((await db.query('SELECT count(*)::int n FROM ai_profiles WHERE account_id=$1',[a])).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM auth.users WHERE id=$1',[id])).rows[0].n,1);ok('AI profiles cleared while Auth remains intact');
 await db.query('ROLLBACK');out.rolledBack=true;
 assert.deepEqual((await db.query('SELECT mvp_private.v25_flags() f')).rows[0].f,initial);assert.equal((await db.query('SELECT count(*)::int n FROM account_deletion_jobs WHERE id=$1',[jid])).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM profiles WHERE id=$1',[id])).rows[0].n,1);ok('Flags, fixture profile and job state restored by rollback');out.complete=true;
 }catch(e){out.failure={code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'CHECK_FAILED',check:/^[A-Z_]+$/.test(e.message||'')?e.message:'ASSERTION'};process.exitCode=1}
 finally{if(db){await db.query('ROLLBACK').catch(()=>{});await db.end()}fs.writeFileSync('docs/v2-production-free-deletion-rehearsal.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out))}})();
