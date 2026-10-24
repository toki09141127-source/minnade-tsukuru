/* eslint-disable @typescript-eslint/no-require-imports */
// Only the staging fixture transaction is writable; always ROLLBACK.
const fs=require('fs'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
const out={complete:false,scope:'staging synthetic bootstrap transaction, rolled back',checks:[],productionChanges:'NONE'};
const ok=name=>out.checks.push({name,pass:true});
(async()=>{let db;try{
 process.env.LOCALAPPDATA='C:/Users/Sonet/AppData/Local';
 const x=await require('../billing/db.cjs')();db=x.db;assert.equal(x.ctx.ref,'fwqucffxdmbdczspkcyr');
 const f=JSON.parse(fs.readFileSync('.staging-private/v2rc-e2e.json'));assert.equal(f.projectRef,x.ctx.ref);
 const ids=f.users.filter(u=>u.label!=='owner').map(u=>u.id);
 const candidate=(await db.query("SELECT u.id FROM auth.users u JOIN profiles p ON p.id=u.id WHERE u.id=ANY($1::uuid[]) AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM admin_users a WHERE a.user_id=u.id) AND NOT EXISTS(SELECT 1 FROM account_deletion_jobs j WHERE j.actor_id=u.id) AND NOT EXISTS(SELECT 1 FROM admin_suspensions s WHERE s.user_id=u.id AND s.suspended) LIMIT 1",[ids])).rows[0];assert.ok(candidate,'SYNTHETIC_CANDIDATE_REQUIRED');
 const id=candidate.id,request=randomUUID();
 const before=(await db.query('SELECT count(*)::int n FROM admin_users')).rows[0].n;
 await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='10s'");
 await db.query('LOCK TABLE admin_users IN SHARE ROW EXCLUSIVE MODE');
 const bootstrap=async()=>{
  const r=await db.query("INSERT INTO admin_users(user_id,role) SELECT $1,'owner' WHERE EXISTS(SELECT 1 FROM auth.users u JOIN profiles p ON p.id=u.id WHERE u.id=$1 AND p.deleted_at IS NULL) AND NOT EXISTS(SELECT 1 FROM account_deletion_jobs WHERE actor_id=$1) AND NOT EXISTS(SELECT 1 FROM admin_suspensions WHERE user_id=$1 AND suspended) ON CONFLICT(user_id) DO NOTHING RETURNING user_id",[id]);
  if(r.rowCount)await db.query("INSERT INTO admin_audit(request_id,actor_id,actor_role,action,target_type,target_id,before_state,after_state,reason,request_hash) VALUES($1,$2::uuid,'owner','bootstrap','staff',($2::uuid)::text,'{}','{\"role\":\"owner\",\"synthetic\":true}','operational','staging-rollback-rehearsal')",[request,id]);
  return r.rowCount;
 };
 assert.equal(await bootstrap(),1);ok('Verified synthetic identity receives Owner plus atomic audit inside transaction');
 assert.equal(await bootstrap(),0);assert.equal((await db.query('SELECT count(*)::int n FROM admin_audit WHERE request_id=$1',[request])).rows[0].n,1);ok('Replay does not duplicate role or audit');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[id,JSON.stringify({sub:id,iat:Math.floor(Date.now()/1000)})]);
 assert.equal((await db.query('SELECT mvp_private.v25_role(true) r')).rows[0].r,'owner');ok('DB role verifies active caller and recent token');
 for(const role of ['anon','authenticated','service_role']){const r=(await db.query("SELECT has_table_privilege($1,'public.admin_users','INSERT,UPDATE,DELETE') w",[role])).rows[0];assert.equal(r.w,false)}ok('No application role can directly bootstrap or self-promote');
 await db.query('SAVEPOINT check_audit');await assert.rejects(db.query('DELETE FROM admin_audit WHERE request_id=$1',[request]));await db.query('ROLLBACK TO SAVEPOINT check_audit');ok('Audit immutable even inside rehearsal');
 await db.query('ROLLBACK');out.rolledBack=true;
 assert.equal((await db.query('SELECT count(*)::int n FROM admin_users')).rows[0].n,before);assert.equal((await db.query('SELECT count(*)::int n FROM admin_users WHERE user_id=$1',[id])).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM admin_audit WHERE request_id=$1',[request])).rows[0].n,0);ok('No role or audit row persists; sequence gaps may remain');
 out.complete=true;
 }catch(e){out.failure={code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'CHECK_FAILED',check:/^[A-Z_]+$/.test(e.message||'')?e.message:'ASSERTION'};process.exitCode=1}
 finally{if(db){await db.query('ROLLBACK').catch(()=>{});await db.end()}fs.writeFileSync('docs/v2-production-owner-rehearsal.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out))}})();
