/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite'),{randomUUID}=require('node:crypto');
let n=0;const ok=(v,l)=>{assert.ok(v,l);console.log(++n+'. '+l)};
(async()=>{const db=new PGlite();try{
await db.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$; CREATE TABLE rooms(id uuid primary key default gen_random_uuid(),title text,category text,is_adult boolean,status text,started_at timestamptz,expires_at timestamptz,created_by uuid,host_ids uuid[],is_hidden boolean,deleted_at timestamptz,time_limit_hours integer,work_type text,concept text,ai_level text,enable_core_approval boolean,enable_core_invite boolean,core_invite_code text);CREATE TABLE room_members(room_id uuid,user_id uuid,role text,joined_at timestamptz,left_at timestamptz);CREATE TABLE account_deletion_jobs(actor_id uuid);");
await db.exec(fs.readFileSync('supabase/migrations/202610210015_room_creation.sql','utf8'));
const actor=randomUUID(),key=randomUUID(),settings={title:'fixture',category:'その他',is_adult:false,time_limit_hours:48,work_type:'room',concept:null,ai_level:'assist',enable_core_approval:false,enable_core_invite:false,core_invite_code:null};
const create=async(req=key,body=settings)=>(await db.query('SELECT mvp_create_room($1,$2,$3) id',[actor,req,body])).rows[0].id;
const id=await create();ok((await db.query('SELECT user_id,role FROM room_members WHERE room_id=$1',[id])).rows[0].user_id===actor,'Room and creator committed together');
ok(await create()===id,'Same creation retry returns original room');
await assert.rejects(create(key,{...settings,title:'changed'}));ok(true,'Changed request payload rejected');
await assert.rejects(create(randomUUID(),{...settings,created_by:randomUUID()}));ok(true,'Client creator override rejected');
await assert.rejects(create(randomUUID(),{...settings,time_limit_hours:1000}));ok(true,'Invalid deadline rejected');
await db.exec("CREATE FUNCTION fail_member() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$; CREATE TRIGGER fail_member BEFORE INSERT ON room_members FOR EACH ROW EXECUTE FUNCTION fail_member();");
const retry=randomUUID();await assert.rejects(create(retry));
ok((await db.query('SELECT count(*)::int n FROM rooms')).rows[0].n===1,'Membership failure rolls back room insert');
await db.exec('DROP TRIGGER fail_member ON room_members');
ok(typeof await create(retry)==='string','Aborted creation safely retries');
await db.query('INSERT INTO account_deletion_jobs VALUES($1)',[actor]);await assert.rejects(create());ok(true,'Withdrawal prevents creation and replay');
await db.exec('CREATE TABLE mvp_rate_limits(actor_id uuid,action text,window_start bigint,hits integer,PRIMARY KEY(actor_id,action,window_start))');
await db.exec(fs.readFileSync('supabase/migrations/202610210016_operator_rate_limits.sql','utf8'));
for(const action of ['account','moderation','moderation_read']){
 const limit=action==='account'?3:action==='moderation'?30:60;
 for(let i=0;i<limit;i++)assert.equal((await db.query('SELECT mvp_take_rate_limit($1,$2) ok',[actor,action])).rows[0].ok,true);
 ok((await db.query('SELECT mvp_take_rate_limit($1,$2) ok',[actor,action])).rows[0].ok===false,'Shared DB limit enforced: '+action);
}
await db.exec('SET ROLE authenticated');await assert.rejects(create());ok(true,'Browser direct RPC denied');
}finally{await db.close()}console.log('Completed '+n+' atomic room creation checks.');})().catch(e=>{console.error(e);process.exitCode=1});
