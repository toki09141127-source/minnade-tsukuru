/* eslint-disable @typescript-eslint/no-require-imports */
const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
let n=0;const ok=(v,l)=>{assert.ok(v,l);console.log(++n+'. '+l)};
(async()=>{const db=new PGlite();try{
await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$; CREATE TABLE rooms(id uuid primary key,is_hidden boolean,deleted_at timestamptz); CREATE TABLE room_likes(room_id uuid,user_id uuid,primary key(room_id,user_id)); CREATE TABLE account_deletion_jobs(actor_id uuid);");
await db.exec(fs.readFileSync('supabase/migrations/202610210014_like_requests.sql','utf8'));
const actor=randomUUID(),room=randomUUID(),key=randomUUID();
await db.query('INSERT INTO rooms VALUES($1,false,null)',[room]);
const set=async(expected,desired,request=key)=> (await db.query('SELECT mvp_set_room_like($1,$2,$3,$4,$5) liked',[actor,room,expected,desired,request])).rows[0].liked;
ok(await set(false,true),'Desired like created');
ok(await set(false,true),'Lost response replay stays liked');
await assert.rejects(set(false,false));ok(true,'Changed payload cannot reuse request');
await assert.rejects(set(false,true,randomUUID()));ok(true,'Stale state rejected');
ok(!await set(true,false,randomUUID()),'Unlike with matching state');
ok(!await set(false,true),'Old request replay returns current state without undoing later unlike');
ok((await db.query('SELECT count(*)::int n FROM room_like_requests')).rows[0].n===2,'Only accepted intents retained');
await db.query('INSERT INTO account_deletion_jobs VALUES($1)',[actor]);
await assert.rejects(set(false,true));ok(true,'Retiring actor cannot replay');
await db.query('DELETE FROM account_deletion_jobs');
await db.query('UPDATE rooms SET is_hidden=true');
await assert.rejects(set(false,true,randomUUID()));ok(true,'Hidden room denied');
await db.query('UPDATE rooms SET is_hidden=false,deleted_at=now()');
await assert.rejects(set(false,true,randomUUID()));ok(true,'Deleted room denied');
await db.exec('SET ROLE authenticated');await assert.rejects(set(false,true));ok(true,'Browser RPC impersonation denied');
await assert.rejects(db.query('INSERT INTO room_likes VALUES($1,$2)',[room,actor]));ok(true,'Direct browser mutation denied');
}finally{await db.close()}console.log('Completed '+n+' like request checks.');})().catch(e=>{console.error(e);process.exitCode=1});
