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
 const owner='11111111-1111-4111-8111-111111111111',operator='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
 for(const [id,name]of [[owner,'Owner'],[operator,'Operator'],[other,'Other']])await db.query('INSERT INTO profiles VALUES($1,$2)',[id,name]);
 await db.query("INSERT INTO posts(id,user_id,username,content) VALUES($1,$1,'Owner','keep content'),($2,$2,'Other','other content')",[owner,other]);
 await db.query('INSERT INTO rooms(id,created_by) VALUES($1,$1)',[owner]);
 await db.query('INSERT INTO moderation_operators VALUES($1)',[operator]);
 await db.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21')",[owner]);
 let seq=0;
 const next=()=> '44444444-4444-4444-8444-'+String(++seq).padStart(12,'0');
 const run=(actor,type,target,hidden,request=next())=>db.query("SELECT mvp_moderate($1,$2,$3,'privacy',$4,$5)",[actor,type,target,hidden,request]);
 await assert.rejects(run(other,'post',owner,true));ok(true,'Nonoperator denied');
 await db.exec('GRANT UPDATE,SELECT ON posts,rooms TO service_role; SET ROLE service_role');
 await assert.rejects(db.query('SELECT * FROM mvp_moderation_capabilities'));ok(true,'Service role cannot read capability storage');
 await assert.rejects(db.query("INSERT INTO mvp_moderation_capabilities VALUES(pg_backend_pid(),txid_current(),'posts',$1,'{}','{}')",[owner]));ok(true,'Service role cannot forge capability');
 await assert.rejects(db.query('UPDATE posts SET is_hidden=true WHERE id=$1',[owner]));ok(true,'Direct privileged visibility write remains fenced');
 await db.exec("SELECT set_config('app.moderation_bypass','true',false)");
 await assert.rejects(db.query("UPDATE posts SET content='bypass' WHERE id=$1",[owner]));ok(true,'Client session flag cannot bypass fence');
 const request=next();
 await run(operator,'post',owner,true,request);ok(true,'Operator hides withdrawing user post through RPC');
 await run(operator,'post',owner,true,request);ok(true,'Identical request safely retried');
 await assert.rejects(run(operator,'post',owner,false,request));ok(true,'Conflicting reuse rejected');
 await run(operator,'post',owner,false);ok(true,'Operator restores same post through scoped RPC');
 await run(operator,'room',owner,true);ok(true,'Operator hides withdrawing creator room');
 await db.exec('RESET ROLE');
 ok((await db.query('SELECT count(*)::int n FROM moderation_actions')).rows[0].n===3,'Exactly one audit per successful unique action');
 ok((await db.query('SELECT content,username,is_hidden FROM posts WHERE id=$1',[owner])).rows[0].content==='keep content','Post body preserved');
 ok((await db.query('SELECT count(*)::int n FROM mvp_moderation_capabilities')).rows[0].n===0,'Capabilities consumed before commit');
 await assert.rejects(db.query("UPDATE posts SET content='after rpc' WHERE id=$1",[owner]));ok(true,'No bypass survives successful RPC');
 await db.exec('SET ROLE authenticated');
 await assert.rejects(run(operator,'post',owner,true));ok(true,'Authenticated cannot call service-only RPC with spoofed operator');
 await db.exec('RESET ROLE');
 await db.query("SELECT set_config('test.uid',$1,false)",[other]);
 await assert.rejects(run(operator,'post',owner,true));ok(true,'JWT identity must match operator argument');
 await db.exec("SELECT set_config('test.uid','',false)");
 // Existing AFTER trigger mutates body of an active target; final exact-row check must roll it all back.
 await db.exec(`CREATE FUNCTION fixture_mutate() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF NEW.is_hidden AND NOT OLD.is_hidden THEN UPDATE posts SET content='side effect' WHERE id=NEW.id; END IF; RETURN NEW; END $$;
 CREATE TRIGGER fixture_mutate AFTER UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION fixture_mutate();`);
 await assert.rejects(run(operator,'post',other,true));ok(true,'Unexpected AFTER trigger mutation aborts action');
 ok((await db.query('SELECT content,is_hidden FROM posts WHERE id=$1',[other])).rows[0].content==='other content','Side effect rolled back');
 ok((await db.query('SELECT count(*)::int n FROM moderation_actions')).rows[0].n===3,'Failed action leaves no audit success record');
 ok((await db.query('SELECT count(*)::int n FROM mvp_moderation_capabilities')).rows[0].n===0,'Failure leaves no capability');
 await db.exec('DROP TRIGGER fixture_mutate ON posts');
 // Audit failure must undo target change too.
 await db.exec(`CREATE FUNCTION fixture_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$;
 CREATE TRIGGER fixture_audit_fail BEFORE INSERT ON moderation_actions FOR EACH ROW EXECUTE FUNCTION fixture_audit_fail();`);
 await assert.rejects(run(operator,'post',owner,true));ok(true,'Audit failure aborts moderation');
 ok((await db.query('SELECT is_hidden FROM posts WHERE id=$1',[owner])).rows[0].is_hidden===false,'Audit failure rolls back visibility');
 await db.exec('DROP TRIGGER fixture_audit_fail ON moderation_actions');
 await db.query("SELECT mvp_request_deletion($1,'keep_name','withdrawal-draft-2026-10-21')",[operator]);
 await assert.rejects(run(operator,'post',owner,true));ok(true,'Withdrawing operator denied even when still assigned');
 }finally{await db.close();}
 console.log('Completed '+n+' scoped moderation checks; synthetic only.');
})().catch(e=>{console.error(e);process.exitCode=1;});

