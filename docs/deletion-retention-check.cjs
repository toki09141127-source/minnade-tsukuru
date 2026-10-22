/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
let n=0;const ok=(v,label)=>{assert.ok(v,label);console.log(++n+'. '+label);};
(async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE decisions(id uuid PRIMARY KEY,event_id uuid,post_id uuid,decided_by uuid,note text,created_at timestamptz);
 CREATE TABLE event_members(id uuid PRIMARY KEY,event_id uuid,user_id uuid,role text,joined_at timestamptz);
 CREATE TABLE room_pre_archive_notes(id uuid PRIMARY KEY,room_id uuid,author_id uuid,author_name text,note text,created_at timestamptz);`);
 for(const file of ['003_account_jobs','007_deletion_lease','008_deletion_retention'])await db.exec(fs.readFileSync('supabase/migrations/202610210'+file+'.sql','utf8'));
 const actor='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const id='33333333-3333-4333-8333-333333333333';
 await db.query("INSERT INTO decisions VALUES($1,$1,$1,$2,'retained decision',now())",[id,actor]);
 await db.query("INSERT INTO event_members VALUES($1,$1,$2,'core',now())",[id,actor]);
 await db.query("INSERT INTO room_pre_archive_notes VALUES($1,$1,$2,'Private Fixture Name','retained note',now()),($2,$1,$3,'Other Name','other note',now())",[id,actor,other]);
 const make=async(who,mode)=>{
 const jid=(await db.query("SELECT mvp_request_deletion($1,$2,'withdrawal-draft-2026-10-21') AS id",[who,mode])).rows[0].id;
 return (await db.query('SELECT * FROM mvp_claim_deletion($1)',[jid])).rows[0];
 };
 const j=await make(actor,'anonymous');
 const run=()=>db.query('SELECT mvp_snapshot_deletion_history($1,$2) AS count',[j.id,j.lease_token]);
 ok((await run()).rows[0].count===3,'Three relevant history rows retained');
 const payload=(await db.query('SELECT payload FROM account_deletion_retention WHERE job_id=$1',[j.id])).rows[0].payload;
 ok(payload.decisions[0].note==='retained decision','Decision content retained');
 ok(payload.room_pre_archive_notes[0].author_name==='退会したメンバー','Anonymous name applied to recovery snapshot');
 ok(!JSON.stringify(payload).includes('Private Fixture Name')&&!JSON.stringify(payload).includes('Other Name'),'Private original display name and another actor history excluded');
 ok(!JSON.stringify(payload).includes(actor),'Actor identity not duplicated in payload');
 ok((await run()).rows[0].count===3,'Idempotent same snapshot');
 ok((await db.query('SELECT author_name FROM room_pre_archive_notes WHERE id=$1',[id])).rows[0].author_name==='Private Fixture Name','Original history unmodified');
 await db.query("UPDATE decisions SET note='changed' WHERE id=$1",[id]);
 await assert.rejects(run());ok(true,'Changed source rejected on retry');
 ok((await db.query('SELECT payload FROM account_deletion_retention WHERE job_id=$1',[j.id])).rows[0].payload.decisions[0].note==='retained decision','First snapshot not overwritten');
 await assert.rejects(db.query('SELECT mvp_snapshot_deletion_history($1,$2)',[j.id,other]));ok(true,'Wrong lease rejected');
 await db.query("UPDATE account_deletion_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[j.id]);
 await assert.rejects(run());ok(true,'Expired lease rejected');
 const k=await make(other,'keep_name');
 await db.query('SELECT mvp_snapshot_deletion_history($1,$2)',[k.id,k.lease_token]);
 ok((await db.query('SELECT payload FROM account_deletion_retention WHERE job_id=$1',[k.id])).rows[0].payload.room_pre_archive_notes[0].author_name==='Other Name','Explicit keep-name choice retained');
 await db.exec('SET ROLE authenticated');
 await assert.rejects(db.query('SELECT * FROM account_deletion_retention'));ok(true,'Browser cannot read private recovery data');
 await assert.rejects(db.query('SELECT mvp_snapshot_deletion_history($1,$2)',[k.id,k.lease_token]));ok(true,'Browser cannot execute retention RPC');
 await db.exec('RESET ROLE');
 }finally{await db.close();}
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/accountDeletionRetention.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports});
 const {createRetentionSnapshotPreparation}=mod.exports;
 const job={id:'job',lease:'lease',actorId:'actor',stage:'requested'};
 const preparation=createRetentionSnapshotPreparation({rpc:async(name,args)=>{assert.equal(name,'mvp_snapshot_deletion_history');assert.equal(args.p_id,job.id);assert.equal(args.p_lease,job.lease);return {data:3,error:null};}});
 ok(await preparation.prepare(job)===null,'Snapshot success does not authorize Auth deletion');
 ok(await preparation.verify(job)===null&&await preparation.finalize(job)===false,'No false verification or completion');
 await assert.rejects(createRetentionSnapshotPreparation({rpc:async()=>({error:{message:'private'}})}).prepare(job),{message:'RETENTION_SNAPSHOT_UNAVAILABLE'});ok(true,'RPC failure sanitized and retryable');
 console.log('Completed '+n+' retention snapshot checks; synthetic only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
