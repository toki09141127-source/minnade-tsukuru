/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),crypto=require('crypto');
module.exports=async(db,report)=>{
 assert.equal(db.connectionParameters.host,'127.0.0.1');
 const run=crypto.randomUUID(),users=['creator','member','other','operator'].map(label=>({id:crypto.randomUUID(),email:'v2free-'+label+'-'+run+'@example.invalid'}));
 const results=[];report.productionTestWindow={complete:false,checks:results};
 const ok=name=>results.push({name,pass:true});
 const denied=async(q,p)=>{await db.query('SAVEPOINT denial');let code;try{await db.query(q,p)}catch(e){code=e.code}await db.query('ROLLBACK TO SAVEPOINT denial');assert.equal(code,'55000')};
 await db.query('BEGIN');try{
 await db.query(require('./free-launch-test-window.cjs').sql(new Date(Date.now()+3600000).toISOString(),users,db.connectionParameters.user));
 await db.query('CREATE TABLE public.release_fixture_probe(id uuid PRIMARY KEY,actor_id uuid,room_id uuid,body text)');
 await db.query('CREATE TRIGGER aaa_release_write_stop BEFORE INSERT OR UPDATE OR DELETE ON public.release_fixture_probe FOR EACH ROW EXECUTE FUNCTION mvp_release_stop.test_write()');
 await db.query('GRANT ALL ON public.release_fixture_probe TO service_role');
 const foreign=crypto.randomUUID(),room=crypto.randomUUID(),post=crypto.randomUUID();
 await db.query("INSERT INTO release_fixture_probe VALUES($1,$2,NULL,'legacy')",[foreign,crypto.randomUUID()]);
 await db.query('SET SESSION AUTHORIZATION supabase_auth_admin');
 await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[users[0].id,users[0].email]);ok('Only exact synthetic Auth identity can sign up through normal triggers');
 await denied('INSERT INTO auth.users(id,email) VALUES($1,$2)',[crypto.randomUUID(),'not-a-test@example.invalid']);ok('Other Auth creation denied');
 await denied('UPDATE auth.users SET email=$1 WHERE id=$2',['changed@example.invalid',users[0].id]);ok('Synthetic email cannot escape allowlist');
 await db.query('RESET SESSION AUTHORIZATION');await db.query('SET SESSION AUTHORIZATION service_role');
 await db.query("INSERT INTO release_fixture_probe VALUES($1,$2,NULL,'TEST')",[room,users[0].id]);
 await db.query("INSERT INTO release_fixture_probe VALUES($1,NULL,$2,'TEST linked')",[post,room]);ok('Direct test ownership and linked test rows allowed');
 await db.query('UPDATE release_fixture_probe SET actor_id=NULL WHERE id=$1',[room]);ok('Anonymization of registered test rows remains possible');
 await denied('UPDATE release_fixture_probe SET body=$1 WHERE id=$2',['NO',foreign]);ok('Existing non-test row denied even for service role');
 await denied('UPDATE release_fixture_probe SET actor_id=$1 WHERE id=$2',[users[0].id,foreign]);ok('Attaching a test UUID cannot seize a non-test row');
 await denied('DELETE FROM release_fixture_probe WHERE id=$1',[foreign]);ok('Non-test deletion denied');
 await denied('UPDATE release_fixture_probe SET id=$1 WHERE id=$2',[crypto.randomUUID(),room]);ok('Primary-key reassignment denied');
 await db.query('DELETE FROM release_fixture_probe WHERE id=$1',[post]);ok('Registered synthetic deletion permitted; production deletion fences still run');
 await db.query('RESET SESSION AUTHORIZATION');
 const scope=(await db.query("SELECT mvp_release_stop.test_row(jsonb_build_object('bucket_id','room_uploads','name',$1::text),'storage','objects') allowed,mvp_release_stop.test_row(jsonb_build_object('bucket_id','room_uploads','name',$2::text),'storage','objects') denied",['rooms/'+room+'/files/test.txt','rooms/'+foreign+'/files/test.txt'])).rows[0];
 assert.equal(scope.allowed,true);assert.equal(scope.denied,false);ok('Storage restricted to registered test-room namespaces');
 report.productionTestWindow.complete=true;
 }catch(e){report.productionTestWindow.failure={code:e.code,where:e.where?.split('\n')[0]?.replace(/SQL statement.*/, 'SQL statement redacted')};throw e}finally{await db.query('ROLLBACK');await db.query('RESET SESSION AUTHORIZATION')}
};
