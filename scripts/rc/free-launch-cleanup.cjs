/* eslint-disable @typescript-eslint/no-require-imports */
const x=require('./free-release-context.cjs'),crypto=require('crypto'),{createClient}=require('@supabase/supabase-js');
(async()=>{let db,client;const out={at:new Date().toISOString(),complete:false};try{
 x.assert.equal(process.argv[2],x.REF);for(const n of ['smoke','security','deletion'])x.assert.equal(x.read('v2-free-'+n+'-result.json').complete,true);
 const f=x.privateRead('v2-free-fixture.aes'),op=f.users[3],env=x.env();db=await x.connect();
 client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const login=await client.auth.signInWithPassword({email:op.email,password:op.password});x.assert.ok(!login.error);
 await db.query('BEGIN');
 x.assert.equal((await db.query("UPDATE admin_users SET active=false,version=version+1 WHERE user_id=$1 AND role='owner' AND active RETURNING user_id",[op.id])).rowCount,1);
 x.assert.equal((await db.query('DELETE FROM moderation_operators WHERE user_id=$1',[op.id])).rowCount,1);
 await db.query("INSERT INTO admin_audit(request_id,actor_id,actor_role,action,target_type,target_id,before_state,after_state,reason,request_hash) VALUES($1,$2::uuid,'owner','bootstrap_cleanup','staff',($2::uuid)::text,'{\"active\":true,\"temporary_test\":true}','{\"active\":false,\"moderation_compatible\":false}','operational',$3)",[crypto.randomUUID(),op.id,crypto.createHash('sha256').update('approved-release-test-owner-cleanup').digest('hex')]);await db.query('COMMIT');
 const read=await client.rpc('v25_admin_read',{p_section:'overview'});x.assert.ok(read.error||read.data?.error==='ADMIN_FORBIDDEN');out.formerTestOwnerDenied=true;
 await client.auth.signOut();const ids=f.users.map(u=>u.id);out.remainingTestSessions=(await db.query('SELECT count(*)::int n FROM auth.sessions WHERE user_id=ANY($1::uuid[])',[ids])).rows[0].n;x.assert.equal(out.remainingTestSessions,0);
 out.activeOwners=(await db.query("SELECT count(*)::int n FROM admin_users WHERE role='owner' AND active")).rows[0].n;x.assert.equal(out.activeOwners,1);
 x.assert.equal((await db.query("SELECT count(*)::int n FROM admin_users a JOIN moderation_operators m ON m.user_id=a.user_id WHERE a.user_id=$1 AND a.active AND a.role='owner'",[x.OWNER])).rows[0].n,1);
 out.realOwnerRetained=true;out.temporaryCompatibilityRemoved=true;out.auditRetained=true;
 for(const u of f.users)delete u.password;f.acceptanceFinishedAt=out.at;x.privateSave('v2-free-fixture.aes',f);out.temporaryCredentialsRemovedFromPrivateFixture=true;out.complete=true;
}catch(e){out.failure=x.P.publicFailure(e);process.exitCode=1}finally{if(client)await client.auth.signOut().catch(()=>{});if(db){await db.query('ROLLBACK').catch(()=>{});await db.end()}x.save('v2-free-test-cleanup.json',out);console.log(JSON.stringify(out))}})();
