/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports,require:n=>load('lib/'+n.replace('./','')+'.ts')});return mod.exports;}
const {createAccountDeletionPorts,unauditedDeletionPreparation}=load('lib/accountDeletionAdapter.ts');
const {resumeAccountDeletion}=load('lib/accountDeletion.ts');
let n=0;function ok(value,label){assert.ok(value,label);console.log(++n+'. '+label);}
function fixture(options={}){
 let stage='requested',exists=true,deletes=0,released=false;
 const rpcCalls=[];
 const client={rpc:async(name,args)=>{
  rpcCalls.push([name,args]);
  if(options.lostLease&&name==='mvp_renew_deletion')return {error:{}};
  if(name==='mvp_claim_deletion')return {data:[{id:'job',actor_id:'actor',stage,lease_token:'lease'}]};
  if(name==='mvp_advance_deletion'){assert.equal(args.p_expected,stage);stage=args.p_next;}
  if(name==='mvp_release_deletion')released=true;
  return {data:name==='mvp_begin_deletion_effect'?'effect':null,error:null};
 },auth:{admin:{
  getUserById:async()=>options.lookupError?{data:{user:null},error:options.lookupError}:exists?{data:{user:{id:options.wrongUser?'other':'actor'}},error:null}:{data:{user:null},error:{status:404,code:'user_not_found'}},
  deleteUser:async(id,soft)=>{assert.equal(id,'actor');assert.equal(soft,false);deletes++;exists=false;return {error:options.deleteError?{}:null};}
 }}};
 const receipt={jobId:'job',actorId:'actor',writesBlocked:true,retainedWorksVerified:true,attributionApplied:true,foreignKeysVerified:true,storageReadyForAuthDeletion:true,...options.receipt};
 const preparation={prepare:async()=>receipt,verify:async()=>options.verifyMissing?null:receipt,finalize:async()=>!options.finalizeFails};
 return {ports:createAccountDeletionPorts(client,options.unaudited?unauditedDeletionPreparation:preparation),state:()=>({stage,exists,deletes,released,rpcCalls})};
}
(async()=>{
 for(const [options,result,label] of [
  [{},'completed','Explicit not-found confirms Auth deletion'],
  [{unaudited:true},'needs_review','Unknown DB/Storage preparation never deletes Auth'],
  [{receipt:{storageReadyForAuthDeletion:false}},'needs_review','Unresolved Storage blocks Auth'],
  [{receipt:{retainedWorksVerified:false}},'needs_review','Unverified retained work blocks Auth'],
  [{receipt:{actorId:'other'}},'needs_review','Receipt for another user rejected'],
  [{receipt:{writesBlocked:false}},'needs_review','Missing write fence blocks Auth'],
  [{verifyMissing:true},'retry','Receipt rechecked immediately before Auth'],
  [{lostLease:true},'retry','Lost lease stops side effects'],
  [{lookupError:{status:500,code:'user_not_found'}},'retry','5xx not absence'],
  [{lookupError:{status:404,code:'unknown'}},'retry','Generic404 not absence'],
  [{lookupError:{status:403,code:'forbidden'}},'retry','Forbidden not absence'],
  [{wrongUser:true},'retry','Mismatching Auth identity rejected'],
  [{deleteError:true},'retry','Delete response loss stays auth_unknown'],
  [{finalizeFails:true},'retry','Incomplete cleanup cannot complete job'],
 ]){
  const f=fixture(options);assert.equal(await resumeAccountDeletion('job',f.ports),result);
  if(result!=='completed'&&!options.deleteError&&!options.finalizeFails)assert.equal(f.state().deletes,0);
  ok(f.state().released,label);
 }
 ok(await resumeAccountDeletion('job',{claim:async()=>{throw Error('unavailable')}})==='retry','Claim outage returns retry without side effects');
 const lost=fixture({deleteError:true});await resumeAccountDeletion('job',lost.ports);
 ok(await resumeAccountDeletion('job',lost.ports)==='completed'&&lost.state().deletes===1,'Response loss resumes by existence check, no duplicate delete');
 const db=new PGlite();
 try{
 await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;');
 await db.exec(fs.readFileSync('supabase/migrations/202610210003_account_jobs.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202610210007_deletion_lease.sql','utf8'));
 const actor='11111111-1111-4111-8111-111111111111';
 const job=(await db.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21') AS id",[actor])).rows[0].id;
 const claim=(await db.query('SELECT * FROM mvp_claim_deletion($1)',[job])).rows[0];
 await db.query("SELECT mvp_renew_deletion($1,$2,'requested')",[job,claim.lease_token]);ok(true,'Live lease renews');
 await assert.rejects(db.query("SELECT mvp_renew_deletion($1,$2,'prepared')",[job,claim.lease_token]));ok(true,'Wrong stage cannot renew');
 await db.query('SELECT mvp_release_deletion($1,$2)',[job,actor]);
 ok((await db.query('SELECT lease_token FROM account_deletion_jobs WHERE id=$1',[job])).rows[0].lease_token===claim.lease_token,'Stale worker cannot release another lease');
 await db.query("UPDATE account_deletion_jobs SET lease_until=now()-interval '1 minute' WHERE id=$1",[job]);
 await assert.rejects(db.query("SELECT mvp_renew_deletion($1,$2,'requested')",[job,claim.lease_token]));ok(true,'Expired lease cannot revive');
 const next=(await db.query('SELECT * FROM mvp_claim_deletion($1)',[job])).rows[0];
 await db.query('SELECT mvp_release_deletion($1,$2)',[job,claim.lease_token]);
 ok((await db.query('SELECT lease_token FROM account_deletion_jobs WHERE id=$1',[job])).rows[0].lease_token===next.lease_token,'Reclaimed lease survives old worker release');

 await db.exec('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE events(id integer PRIMARY KEY,created_by uuid REFERENCES auth.users(id)); CREATE TABLE novel_drafts(id integer PRIMARY KEY,updated_by uuid REFERENCES auth.users(id)); CREATE TABLE decisions(id integer PRIMARY KEY,decided_by uuid REFERENCES auth.users(id) ON DELETE CASCADE); CREATE TABLE room_pre_archive_notes(id integer PRIMARY KEY,author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);');
 await db.query('INSERT INTO auth.users VALUES($1)',[actor]);
 await db.query('INSERT INTO events VALUES(1,$1)',[actor]);
 await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1',[actor]));ok(true,'Audited events FK prevents Auth deletion');
 await db.exec('DELETE FROM events');
 await db.query('INSERT INTO novel_drafts VALUES(1,$1)',[actor]);
 await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1',[actor]));ok(true,'Audited novel draft FK prevents Auth deletion');
 await db.exec('DELETE FROM novel_drafts');
 await db.query('INSERT INTO decisions VALUES(1,$1)',[actor]);
 await db.query('INSERT INTO room_pre_archive_notes VALUES(1,$1)',[actor]);
 await db.query('DELETE FROM auth.users WHERE id=$1',[actor]);
 ok((await db.query('SELECT * FROM decisions')).rows.length===0,'Auth CASCADE removes decisions in synthetic DB');
 ok((await db.query('SELECT * FROM room_pre_archive_notes')).rows.length===0,'Auth CASCADE removes pre-archive notes in synthetic DB');
 await db.exec('SET ROLE authenticated');
 await assert.rejects(db.query("SELECT mvp_renew_deletion($1,$2,'requested')",[job,next.lease_token]));ok(true,'Browser cannot renew deletion lease');
 await db.exec('RESET ROLE');
 }finally{await db.close();}
 console.log('Completed '+n+' deletion adapter checks; no external effects.');
})().catch(e=>{console.error(e);process.exitCode=1;});
