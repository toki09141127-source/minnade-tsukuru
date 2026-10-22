/* eslint-disable @typescript-eslint/no-require-imports */
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const actor='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const room='33333333-3333-4333-8333-333333333333';
const secondRoom='44444444-4444-4444-8444-444444444444';
const upload='55555555-5555-4555-8555-555555555555';
const key='66666666-6666-4666-8666-666666666666';
let n=0;
(async()=>{
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key);
 CREATE TABLE public.rooms(id uuid primary key,status text,is_hidden boolean,deleted_at timestamptz,expires_at timestamptz);
 CREATE TABLE public.room_members(id uuid primary key default gen_random_uuid(),room_id uuid references rooms(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,role text,left_at timestamptz,unique(room_id,user_id));
 CREATE TABLE public.public_profiles(id uuid primary key,username text);
 CREATE TABLE public.posts(id uuid primary key default gen_random_uuid(),room_id uuid references rooms(id) on delete cascade,user_id uuid not null,username text,content text,post_type text,attachment_url text,attachment_type text,is_hidden boolean,deleted_at timestamptz);
 GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
 GRANT ALL ON public.posts TO anon,authenticated;
 GRANT UPDATE(attachment_url),INSERT(attachment_url) ON public.posts TO authenticated;`);
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/202610210001_attachment_ledger.sql'),'utf8').replace(/^\uFEFF/,''));
 async function reset(){await db.exec(`RESET ROLE; TRUNCATE public.post_requests,public.attachment_uploads,public.posts,public.room_members,public.rooms,auth.users,public.public_profiles,public.mvp_rate_limits CASCADE;
 INSERT INTO auth.users VALUES('${actor}'),('${other}');
 INSERT INTO rooms VALUES('${room}','open',false,null),('${secondRoom}','open',false,null);
 INSERT INTO room_members(room_id,user_id,role) VALUES('${room}','${actor}','core'),('${room}','${other}','supporter'),('${secondRoom}','${actor}','core');
 INSERT INTO public_profiles VALUES('${actor}','fixture');
 INSERT INTO attachment_uploads(id,user_id,room_id,storage_path,status,uploaded_at,mime_type,size_bytes)
 VALUES('${upload}','${actor}','${room}','rooms/${room}/images/test.png','uploaded',now(),'image/png',8);`);}
 async function call(overrides={}) { const p={actor,room,content:'fixture',type:'log',upload,key,...overrides};
  return (await db.query('SELECT public.create_post_with_upload($1,$2,$3,$4,$5,$6) AS id',[p.actor,p.room,p.content,p.type,p.upload,p.key])).rows[0].id; }
 function ok(value,label){assert.ok(value,label);console.log(++n+'. '+label);}
 async function denied(fn,code,label){await assert.rejects(fn,new RegExp(code));ok(true,label);}
 await reset(); await db.exec('SET ROLE service_role'); const id=await call();
 ok((await db.query('SELECT status,post_id,used_at FROM attachment_uploads')).rows[0].post_id===id,'Post and ledger bind together');
 ok(await call()===id,'Same key and payload replays same post');
 ok(/^[a-f0-9]{64}$/.test((await db.query('SELECT payload_hash FROM post_requests')).rows[0].payload_hash),'Request stores SHA256 only, not duplicate content');
 await denied(()=>call({key:other}),'UPLOAD_UNAVAILABLE','Different key cannot reuse upload');
 await denied(()=>call({content:'changed'}),'REQUEST_CONFLICT','Same key cannot change payload');
 for(const [sql,code,label] of [
  [`UPDATE attachment_uploads SET user_id='${other}'`,'UPLOAD_UNAVAILABLE','Other owner'],
  [`UPDATE attachment_uploads SET room_id='${secondRoom}'`,'UPLOAD_UNAVAILABLE','Other room'],
  ["UPDATE attachment_uploads SET expires_at=now()-interval '1 second'",'UPLOAD_UNAVAILABLE','Expired'],
  ["UPDATE attachment_uploads SET status='reserved',uploaded_at=null",'UPLOAD_UNAVAILABLE','Not uploaded'],
  ["UPDATE attachment_uploads SET status='failed'",'UPLOAD_UNAVAILABLE','Failed upload'],
  ["UPDATE attachment_uploads SET status='cleanup_pending'",'UPLOAD_UNAVAILABLE','Cleanup claimed'],
  ["UPDATE rooms SET is_hidden=true",'ROOM_UNAVAILABLE','Hidden room'],
  ["UPDATE room_members SET role=null",'NOT_MEMBER','Unknown role'],
  ["UPDATE rooms SET status=null",'ROOM_UNAVAILABLE','Unknown status'],
  ["UPDATE rooms SET is_hidden=null",'ROOM_UNAVAILABLE','Unknown visibility'],
  ["UPDATE rooms SET deleted_at=now()",'ROOM_UNAVAILABLE','Deleted room'],
  ["UPDATE rooms SET status='forced_publish'",'ROOM_UNAVAILABLE','Published room'],
  ["UPDATE room_members SET left_at=now()",'NOT_MEMBER','Former member'],
  ["DELETE FROM room_members",'NOT_MEMBER','Nonmember'],
 ]) {await reset();await db.exec(sql);await denied(()=>call(),code,label);ok((await db.query('SELECT count(*)::int AS n FROM posts')).rows[0].n===0,label+' has no post side effect');}
 await reset();await denied(()=>call({actor:other,type:'final',upload:null}),'FINAL_FORBIDDEN','Supporter final denied');
 ok(!!await call({upload:null}),'Text-only post works');
 await reset();await denied(()=>call({content:'x'.repeat(20001)}),'INVALID_INPUT','Oversized text denied');
 await reset();await denied(()=>call({upload:other}),'UPLOAD_UNAVAILABLE','Missing upload denied');
 await reset();const linked=await call();await db.query('DELETE FROM posts WHERE id=$1',[linked]);
 ok((await db.query('SELECT used_at,post_id FROM attachment_uploads')).rows[0].used_at!==null,'Deleting post preserves used tombstone');
 await denied(()=>call({key:other}),'UPLOAD_UNAVAILABLE','Deleted post upload cannot be reused');
 await denied(()=>call(),'POST_UNAVAILABLE','Deleted post retry cannot recreate');
 await reset();await db.query('DELETE FROM auth.users WHERE id=$1',[actor]);
 ok((await db.query('SELECT user_id FROM attachment_uploads')).rows[0].user_id===null,'Owner FK preserves ledger on deletion');
 await denied(()=>call(),'NOT_MEMBER','Deleted owner cannot bind');
 await reset();await db.query('DELETE FROM rooms WHERE id=$1',[room]);
 ok((await db.query('SELECT room_id FROM attachment_uploads')).rows[0].room_id===null,'Room FK preserves cleanup path');
 await reset();await db.exec(`CREATE FUNCTION test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'FIXTURE_FAILURE'; END $$;
 CREATE TRIGGER fixture_fail BEFORE INSERT ON post_requests FOR EACH ROW EXECUTE FUNCTION test_fail();`);
 await denied(()=>call(),'FIXTURE_FAILURE','Post request failure rolls whole transaction back');
 ok((await db.query('SELECT count(*)::int AS n FROM posts')).rows[0].n===0 && (await db.query('SELECT status FROM attachment_uploads')).rows[0].status==='uploaded','Rollback leaves no post and upload unused');
 await db.exec('DROP TRIGGER fixture_fail ON post_requests; DROP FUNCTION test_fail();');
 for(const role of ['anon','authenticated']) {
  await reset();await db.exec('SET ROLE '+role);
  await denied(()=>call(),'permission denied','Untrusted role cannot execute actor RPC: '+role);
  await denied(()=>db.query('SELECT * FROM attachment_uploads'),'permission denied','Untrusted role cannot read ledger: '+role);
  await denied(()=>db.query("UPDATE posts SET attachment_url='fake'"),'permission denied','Direct path mutation denied: '+role);
 }
 await reset();await db.exec('SET ROLE service_role');
 for(let i=0;i<20;i++) assert.equal((await db.query('SELECT mvp_take_rate_limit($1,$2) AS allowed',[actor,'posts'])).rows[0].allowed,true);
 ok(!(await db.query('SELECT mvp_take_rate_limit($1,$2) AS allowed',[actor,'posts'])).rows[0].allowed,'21st post in fixed window denied');
 ok((await db.query('SELECT mvp_take_rate_limit($1,$2) AS allowed',[other,'posts'])).rows[0].allowed,'Rate limit isolated by actor');
 await db.close(); console.log('Completed '+n+' local PostgreSQL checks. Synthetic schema only; not Supabase or multi-connection validation.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
