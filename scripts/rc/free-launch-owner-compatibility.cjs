/* eslint-disable @typescript-eslint/no-require-imports */
const x=require('./free-release-context.cjs'),crypto=require('crypto');
(async()=>{let db;const out={at:new Date().toISOString(),complete:false};try{
 x.assert.equal(process.argv[2],x.REF);db=await x.connect();const f=x.privateRead('v2-free-fixture.aes'),op=f.users[3].id;
 const acl=(await db.query("SELECT has_function_privilege('authenticated','public.mvp_moderate(uuid,text,uuid,text,boolean,uuid)','EXECUTE') a,has_function_privilege('service_role','public.mvp_moderate(uuid,text,uuid,text,boolean,uuid)','EXECUTE') s")).rows[0];x.assert.ok(!acl.a&&!acl.s);out.directLegacyRpcDenied=true;
 await db.query('BEGIN');await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:op,role:'authenticated',iat:Math.floor(Date.now()/1000)})]);
 let version=(await db.query("SELECT coalesce((SELECT version FROM admin_subjects WHERE kind='room' AND target_id=$1),0) version",[f.room])).rows[0].version;
 const action=async(value)=> (await db.query("SELECT v25_admin_action($1,'hide','work',$2,$3,$4::jsonb,'other','TEST bootstrap compatibility rehearsal') x",[crypto.randomUUID(),f.room,version,JSON.stringify(value)])).rows[0].x;
 const missing=await action(true);x.assert.equal(missing.error,'ADMIN_ACTION_FAILED');out.missingCompatibilityEntryReproduced=true;
 await db.query('INSERT INTO moderation_operators(user_id) VALUES($1)',[op]);const ok=await action(true);x.assert.equal(ok.ok,true);out.existingVersionedOwnerHidePass=true;
 version=ok.state.version;const restore=await action(false);x.assert.equal(restore.ok,true);await db.query('ROLLBACK');out.rehearsalRolledBack=true; if(process.argv[3]!=='apply'){out.complete=true;return;}
 await db.query('BEGIN');await db.query('LOCK TABLE admin_users IN SHARE ROW EXCLUSIVE MODE');
 for(const uid of [x.OWNER,op]){
  const r=(await db.query("SELECT count(*)::int n FROM admin_users a JOIN auth.users u ON u.id=a.user_id JOIN profiles p ON p.id=u.id WHERE a.user_id=$1 AND a.role='owner' AND a.active AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM account_deletion_jobs WHERE actor_id=u.id) AND NOT EXISTS(SELECT 1 FROM admin_suspensions WHERE user_id=u.id AND suspended)",[uid])).rows[0];x.assert.equal(r.n,1);
  x.assert.equal((await db.query('INSERT INTO moderation_operators(user_id) VALUES($1) ON CONFLICT DO NOTHING',[uid])).rowCount,1);
  await db.query("INSERT INTO admin_audit(request_id,actor_id,actor_role,action,target_type,target_id,before_state,after_state,reason,request_hash) VALUES($1,$2::uuid,'owner','bootstrap','staff',($2::uuid)::text,'{\"moderation_compatible\":false}','{\"moderation_compatible\":true}','operational',$3)",[crypto.randomUUID(),uid,crypto.createHash('sha256').update('approved-owner-bootstrap-compatibility-v1').digest('hex')]);
 }await db.query('COMMIT');out.designatedOwnerAndTemporaryTestOwnerLinked=true;out.auditAtomic=true;out.schemaOrGrantsChanged=false;out.complete=true;
}catch(e){out.failure=x.P.publicFailure(e);out.failure.code=/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'UNCLASSIFIED';process.exitCode=1}finally{if(db){await db.query('ROLLBACK').catch(()=>{});await db.end()}x.save('v2-free-owner-compatibility.json',out);console.log(JSON.stringify(out))}})();
