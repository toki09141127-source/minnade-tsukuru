/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
let n=0;const ok=(v,label)=>{assert.ok(v,label);console.log(++n+'. '+label)};
(async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE TABLE profiles(id uuid PRIMARY KEY,username text UNIQUE NOT NULL);
 CREATE TABLE public_profiles(id uuid PRIMARY KEY,username text NOT NULL);
 CREATE TABLE posts(id uuid PRIMARY KEY,user_id uuid,username text,content text);
 CREATE TABLE room_members(id uuid PRIMARY KEY,user_id uuid,username text);
 CREATE TABLE rooms(id uuid PRIMARY KEY,created_by uuid);
 CREATE TABLE room_join_requests(id uuid PRIMARY KEY,user_id uuid,decided_by uuid);
 CREATE TABLE events(id uuid PRIMARY KEY,created_by uuid NOT NULL);
 CREATE TABLE event_members(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE decisions(id uuid PRIMARY KEY,decided_by uuid);
 CREATE TABLE novel_drafts(event_id uuid PRIMARY KEY,updated_by uuid);
 CREATE TABLE room_pre_archive_notes(id uuid PRIMARY KEY,author_id uuid,author_name text,note text);`);
 await db.exec(fs.readFileSync('supabase/migrations/202610210003_account_jobs.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202610210009_deletion_attribution_fence.sql','utf8'));

 await db.exec('ALTER TABLE posts ADD COLUMN is_hidden boolean NOT NULL DEFAULT false, ADD COLUMN deleted_at timestamptz; ALTER TABLE rooms ADD COLUMN is_hidden boolean NOT NULL DEFAULT false, ADD COLUMN deleted_at timestamptz;');
 await db.exec(fs.readFileSync('supabase/migrations/202610210004_moderation.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202610210010_scoped_moderation.sql','utf8'));

 await db.exec('CREATE TABLE reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_user_id uuid NOT NULL,target_type text NOT NULL,target_id uuid NOT NULL,reason text NOT NULL,target_room_id uuid,target_post_id uuid);');
 await db.exec(fs.readFileSync('supabase/migrations/202610210011_report_intake.sql','utf8'));
 const owner='11111111-1111-4111-8111-111111111111',reporter='22222222-2222-4222-8222-222222222222',active='33333333-3333-4333-8333-333333333333';
 for(const [id,name]of [[owner,'Owner'],[reporter,'Reporter'],[active,'Active']])await db.query('INSERT INTO profiles VALUES($1,$2)',[id,name]);
 await db.query("INSERT INTO posts(id,user_id,username,content) VALUES($1,$1,'Owner','keep'),($2,$2,'Active','keep')",[owner,active]);
 await db.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21')",[owner]);
 await db.exec(`CREATE FUNCTION fixture_auto_hide() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 UPDATE posts SET is_hidden=true WHERE id=NEW.target_id;
 RETURN NEW;
 END $$;
 CREATE TRIGGER fixture_auto_hide AFTER INSERT ON reports FOR EACH ROW EXECUTE FUNCTION fixture_auto_hide();`);
 let seq=0;const next=()=> '44444444-4444-4444-8444-'+String(++seq).padStart(12,'0');
 const receive=(actor,target,request=next(),reason='fixture')=>db.query("SELECT * FROM mvp_receive_report($1,$2,'post',$3,$4)",[actor,request,target,reason]);
 const key=next(),first=(await receive(reporter,owner,key)).rows[0];
 ok(first.processing_state==='pending','Write-fence rejection keeps receipt pending');
 ok((await db.query('SELECT count(*)::int n FROM report_intake')).rows[0].n===1,'Receipt committed despite legacy trigger failure');
 ok((await db.query('SELECT count(*)::int n FROM reports')).rows[0].n===0,'Failed legacy insert rolled back only inside subtransaction');
 ok((await db.query('SELECT is_hidden FROM posts WHERE id=$1',[owner])).rows[0].is_hidden===false,'Withdrawal fence still blocks auto-hide');
 ok((await receive(reporter,owner,key)).rows[0].receipt_id===first.receipt_id,'Response-loss retry returns same receipt');
 await assert.rejects(receive(reporter,owner,key,'changed'));ok(true,'Conflicting retry rejected');
 const success=(await receive(reporter,active)).rows[0];
 ok(success.processing_state==='processed','Legacy success marked processed');
 ok((await db.query('SELECT is_hidden FROM posts WHERE id=$1',[active])).rows[0].is_hidden===true,'Existing auto-hide succeeds for writable target');
 // Arbitrary unexpected legacy error remains pending without leaking exception text.
 await db.exec(`CREATE OR REPLACE FUNCTION fixture_auto_hide() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'private secret fixture'; END $$;`);
 const unexpected=(await receive(reporter,active)).rows[0];
 ok(unexpected.processing_state==='pending','Unexpected trigger failure also preserves receipt');
 const row=(await db.query('SELECT failure_code FROM report_intake WHERE id=$1',[unexpected.receipt_id])).rows[0];
 ok(row.failure_code==='P0001','Only SQLSTATE recorded, not exception message');
 await assert.rejects(receive(owner,active));ok(true,'Withdrawing reporter denied');
 await assert.rejects(db.query("INSERT INTO reports(reporter_user_id,target_type,target_id,reason) VALUES($1,'post',$2,'fixture')",[owner,active]));ok(true,'Direct legacy report route also fenced by reporter_user_id');
 await db.query("SELECT set_config('test.uid',$1,false)",[active]);
 await assert.rejects(receive(reporter,owner));ok(true,'JWT actor mismatch rejected');
 await db.exec("SELECT set_config('test.uid','',false)");
 await db.exec('SET ROLE authenticated');
 await assert.rejects(receive(reporter,owner));ok(true,'Browser cannot spoof service RPC');
 await assert.rejects(db.query('SELECT * FROM report_intake'));ok(true,'Browser cannot read private reports');
 await db.exec('RESET ROLE');
 const before=(await db.query('SELECT count(*)::int n FROM report_intake')).rows[0].n;
 await db.exec(`CREATE FUNCTION fixture_intake_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'storage unavailable'; END $$;
 CREATE TRIGGER fixture_intake_fail BEFORE INSERT ON report_intake FOR EACH ROW EXECUTE FUNCTION fixture_intake_fail();`);
 await assert.rejects(receive(reporter,owner));ok(true,'Receipt persistence failure does not claim success');
 ok((await db.query('SELECT count(*)::int n FROM report_intake')).rows[0].n===before,'Failed receipt leaves no partial row');
 }finally{await db.close();}
 console.log('Completed '+n+' report intake checks; synthetic only.');
})().catch(e=>{console.error(e);process.exitCode=1;});

