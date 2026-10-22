/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite'),{randomUUID}=require('node:crypto');
let n=0;const ok=(v,label)=>{assert.ok(v,label);console.log(++n+'. '+label)};
const compiled={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/uploadCleanup.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:compiled,exports:compiled.exports});
const {cleanupOneExpiredUpload}=compiled.exports;
(async()=>{
const db=new PGlite();try{
await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key); CREATE TABLE rooms(id uuid primary key,status text,is_hidden boolean,deleted_at timestamptz,expires_at timestamptz); CREATE TABLE room_members(id uuid,room_id uuid,user_id uuid,left_at timestamptz,role text); CREATE TABLE public_profiles(id uuid,username text); CREATE TABLE posts(id uuid primary key,room_id uuid,user_id uuid,username text,content text,post_type text,attachment_url text,attachment_type text,is_hidden boolean,deleted_at timestamptz); CREATE TABLE account_deletion_jobs(actor_id uuid);");
await db.exec(fs.readFileSync('supabase/migrations/202610210001_attachment_ledger.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/202610210013_upload_cleanup.sql','utf8'));
const actor=randomUUID(),room=randomUUID(),id=randomUUID();
await db.query("INSERT INTO auth.users VALUES($1)",[actor]);await db.query("INSERT INTO rooms(id) VALUES($1)",[room]);
await db.query("INSERT INTO attachment_uploads(id,user_id,room_id,storage_path,status,uploaded_at,mime_type,size_bytes,expires_at) VALUES($1,$2,$3,$4,'uploaded',now(),'image/png',8,now()-interval '1 hour')",[id,actor,room,'rooms/'+room+'/images/'+id+'.png']);
const claim=async()=> (await db.query('SELECT * FROM mvp_claim_upload_cleanup()')).rows;
let rows=await claim(),first=rows[0];
ok(rows.length===1&&first.id===id,'Only expired successfully uploaded row claimed');
ok((await claim()).length===0,'Live lease excludes second worker');
await assert.rejects(db.query('SELECT mvp_finish_upload_cleanup($1,$2)',[id,randomUUID()]));ok(true,'Wrong token cannot finalize');
await db.query("UPDATE attachment_uploads SET cleanup_until=now()-interval '1 second' WHERE id=$1",[id]);
const second=(await claim())[0];ok(second.cleanup_token!==first.cleanup_token,'Expired lease replaces token');
await assert.rejects(db.query('SELECT mvp_finish_upload_cleanup($1,$2)',[id,first.cleanup_token]));ok(true,'Old worker cannot finalize new lease');
let removes=0,finishFail=true;
const client={rpc:async(name,args)=>{if(name==='mvp_claim_upload_cleanup')return {data:[second]};if(finishFail)return {error:{}};await db.query('SELECT mvp_finish_upload_cleanup($1,$2)',[args.p_id,args.p_token]);return {error:null}},storage:{from:()=>({remove:async paths=>{removes++;assert.deepEqual(Array.from(paths),[second.storage_path]);return {error:null}}})}};
ok(await cleanupOneExpiredUpload(client)==='retry','Storage success plus DB failure stays retryable');
finishFail=false;ok(await cleanupOneExpiredUpload(client)==='deleted'&&removes===2,'Repeated idempotent remove followed by DB confirmation');
ok((await claim()).length===0,'Deleted tombstone never reclaimed');
for(const change of [{bucket:'other'},{storage_path:'rooms/'+room+'/images/../secret'},{storage_path:'rooms/'+room+'/images/'+randomUUID()+'.png'},{room_id:randomUUID()}]){
const before=removes;
ok(await cleanupOneExpiredUpload({...client,rpc:async()=>({data:[{...second,...change}]})})==='needs_review'&&removes===before,'Malformed or legacy path never removed');
}
const insert=async(status,used=null,uploaded=true)=>{const key=randomUUID();await db.query("INSERT INTO attachment_uploads(id,user_id,room_id,storage_path,status,used_at,uploaded_at,mime_type,size_bytes,expires_at) VALUES($1,$2,$3,$1::uuid::text,$4,$5,$6,'image/png',8,now()-interval '1 hour')",[key,actor,room,status,used,uploaded?new Date():null]);};
await insert('bound',new Date());await insert('reserved',null,false);await insert('failed',null,false);
ok((await claim()).length===0,'Bound, uncertain reserved and failed uploads preserved');
await insert('uploaded');await db.query('INSERT INTO account_deletion_jobs VALUES($1)',[actor]);
ok((await claim()).length===0,'Retiring owner left for reviewed deletion workflow');
await db.exec('SET ROLE authenticated');await assert.rejects(claim());ok(true,'Browser role cannot claim cleanup');
}finally{await db.close()}
console.log('Completed '+n+' upload cleanup checks; synthetic/mocked Storage only.');
})().catch(e=>{console.error(e);process.exitCode=1});
