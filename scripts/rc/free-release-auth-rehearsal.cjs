/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),crypto=require('crypto');
module.exports=async(db,report)=>{
 assert.equal(db.connectionParameters.host,'127.0.0.1');
 const a=require('./free-release-auth-window.cjs'),id=crypto.randomUUID(),other=crypto.randomUUID();
 const testEmail='rehearsal-'+crypto.randomUUID()+'@example.invalid';
 const results=[];report.authMaintenanceWindow={complete:false,checks:results};const ok=name=>results.push({name,pass:true});
 const denied=async(query,args)=>{await db.query('SAVEPOINT negative');let failure;try{await db.query(query,args)}catch(e){failure=e.code}await db.query('ROLLBACK TO SAVEPOINT negative');if(failure!=='55000'){report.authMaintenanceWindow.denialCode=failure||'NO_DENIAL';throw Error('WINDOW_DENIAL_MISMATCH')}};
 await db.query('BEGIN');try{
  await db.query(a.sql(new Date(Date.now()+3600000).toISOString(),db.connectionParameters.user,testEmail));
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,'not-allowed@example.invalid')",[other]);
  await db.query('SET SESSION AUTHORIZATION supabase_auth_admin');
  await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,testEmail]);ok('Exact disposable signup creates Auth/profile with normal triggers');
  await db.query('UPDATE auth.users SET updated_at=clock_timestamp() WHERE id=$1',[id]);ok('Exact test login/recovery metadata write allowed');
  await db.query('UPDATE auth.users SET updated_at=clock_timestamp() WHERE id=$1',[a.OWNER]);ok('Designated Owner login metadata allowed');
  await denied('INSERT INTO auth.users(id,email) VALUES($1,$2)',[crypto.randomUUID(),'blocked@example.invalid']);ok('Other signup denied');
  await denied('UPDATE auth.users SET email=$1 WHERE id=$2',['escape@example.invalid',id]);ok('Test email change cannot escape allowlist');
  await denied('UPDATE auth.users SET updated_at=clock_timestamp() WHERE id=$1',[other]);ok('Other Auth update denied');
  await denied('DELETE FROM auth.users WHERE id=$1',[id]);ok('Deletion remains blocked');
  await db.query('RESET SESSION AUTHORIZATION');
  await db.query('SET SESSION AUTHORIZATION service_role');
  await db.query("UPDATE public.profiles SET username='TEST RELEASE' WHERE id=$1",[id]);ok('Own test profile updates remain possible');
  await denied("UPDATE public.profiles SET username='TEST BLOCKED' WHERE id=$1",[other]);ok('Other profile writes blocked even for Service Role');
  await denied('UPDATE public.rooms SET id=id WHERE false');ok('All room writes remain blocked');
  await db.query('RESET SESSION AUTHORIZATION');
  await db.query(a.sql(new Date(Date.now()-1000).toISOString(),db.connectionParameters.user,testEmail));
  await db.query('SET SESSION AUTHORIZATION supabase_auth_admin');
  await denied('UPDATE auth.users SET updated_at=clock_timestamp() WHERE id=$1',[id]);ok('Expired window denies test Auth writes');
 }finally{await db.query('ROLLBACK');await db.query('RESET SESSION AUTHORIZATION')}
 report.authMaintenanceWindow={complete:true,checks:results,scope:'Actual isolated production clone; all fixture rows and window DDL rolled back; no hosted Auth request'};
};
