/* eslint-disable @typescript-eslint/no-require-imports */
const vm=require('node:vm'),ts=require('typescript');
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
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 for(const [id,name]of [[a,'Alice'],[b,'Bob'],[c,'Carol']]){
 await db.query('INSERT INTO profiles VALUES($1,$2)',[id,name]);
 await db.query('INSERT INTO public_profiles VALUES($1,$2)',[id,name]);
 await db.query("INSERT INTO posts VALUES($1,$1,$2,'shared work')",[id,name]);
 await db.query('INSERT INTO room_members VALUES($1,$1,$2)',[id,name]);
 await db.query("INSERT INTO room_pre_archive_notes VALUES($1,$1,$2,'history')",[id,name]);
 }
 const request=(actor,mode)=>db.query("SELECT mvp_request_deletion($1,$2,'withdrawal-draft-2026-10-21') AS id",[actor,mode]);
 const j=(await request(a,'anonymous')).rows[0].id;
 ok((await db.query('SELECT username,content FROM posts WHERE user_id=$1',[a])).rows[0].username==='退会したメンバー','Public post name anonymized');
 ok((await db.query('SELECT content FROM posts WHERE user_id=$1',[a])).rows[0].content==='shared work','Shared work content retained');
 ok((await db.query('SELECT author_name,note FROM room_pre_archive_notes WHERE author_id=$1',[a])).rows[0].note==='history','Production history retained in place');
 ok((await request(a,'anonymous')).rows[0].id===j,'Duplicate request idempotent');
 await assert.rejects(request(a,'keep_name'));ok(true,'Cannot change agreed attribution after request');
 for(const [sql,args] of [
 ["UPDATE posts SET content='changed' WHERE user_id=$1",[a]],
 ["DELETE FROM posts WHERE user_id=$1",[a]],
 ['INSERT INTO posts VALUES(gen_random_uuid(),$1,\'x\',\'x\')',[a]],
 ['UPDATE posts SET user_id=$1 WHERE user_id=$2',[b,a]],
 ['UPDATE posts SET user_id=$1 WHERE user_id=$2',[a,b]],
 ["UPDATE profiles SET username='back' WHERE id=$1",[a]],
 ['DELETE FROM room_members WHERE user_id=$1',[a]],
 ['INSERT INTO events VALUES(gen_random_uuid(),$1)',[a]],
 ]){
 await assert.rejects(db.query(sql,args));ok(true,'Retiring account write rejected: '+sql.split(' ')[0]);
 }
 await db.query("UPDATE posts SET content='active change' WHERE user_id=$1",[b]);ok(true,'Active user remains writable');
 await db.query("SELECT set_config('test.uid',$1,false)",[a]);
 await assert.rejects(db.query("UPDATE posts SET content='spoof' WHERE user_id=$1",[b]));ok(true,'JWT actor fence rejects writes to another user row');
 await db.exec("SELECT set_config('test.uid','',false)");
 await request(b,'keep_name');
 ok((await db.query('SELECT public_name FROM mvp_departed_author_labels(ARRAY[$1]::uuid[])',[b])).rows[0].public_name==='Bob','Chosen public name retained independently from Auth');
 ok((await db.query('SELECT username FROM posts WHERE user_id=$1',[b])).rows[0].username==='Bob','Keep-name original unchanged');
 // Simulate an existing AFTER trigger undoing an attribution update.
 await db.exec(`CREATE FUNCTION fixture_undo_name() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF NEW.username='退会したメンバー' THEN UPDATE posts SET username='unexpected' WHERE id=NEW.id; END IF;
 RETURN NEW;
 END $$;
 CREATE TRIGGER fixture_name AFTER UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION fixture_undo_name();`);
 await assert.rejects(request(c,'anonymous'));ok(true,'Unexpected trigger side effect rejects whole request');
 ok((await db.query('SELECT username FROM profiles WHERE id=$1',[c])).rows[0].username==='Carol','Failed request rolls back prior profile update');
 ok((await db.query('SELECT id FROM account_deletion_jobs WHERE actor_id=$1',[c])).rows.length===0,'Failed request leaves no job or write fence');
 await db.exec('SET ROLE anon');
 await assert.rejects(db.query('SELECT * FROM account_departed_authors'));ok(true,'Private job mapping inaccessible to anon');
 ok((await db.query('SELECT * FROM mvp_departed_author_labels(ARRAY[$1]::uuid[])',[a])).rows[0].public_name==='退会したメンバー','Anon obtains only public label through RPC');
 await assert.rejects(db.query('SELECT * FROM mvp_departed_author_labels(array_fill($1::uuid,ARRAY[201]))',[a]));ok(true,'Public lookup bounded');
 await db.exec('RESET ROLE');
 await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ');
 await assert.rejects(db.query("UPDATE posts SET content='x' WHERE user_id=$1",[c]));
 await db.exec('ROLLBACK');ok(true,'Unsupported snapshot isolation fails closed');
 }finally{await db.close()}
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/departedAuthorLabels.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports});
 const {departedAuthorLabels}=mod.exports;
 let sizes=[];
 const labels=await departedAuthorLabels({rpc:async(name,args)=>{sizes.push(args.p_actors.length);return {data:args.p_actors.map(id=>({actor_id:id,public_name:'Retired'})),error:null}}},Array.from({length:201},(_,i)=>String(i)));
 ok(sizes.join(',')==='200,1'&&labels.size===201,'Public attribution lookup bounded in batches');
 await assert.rejects(departedAuthorLabels({rpc:async()=>({error:{message:'private'}})},['actor']),{message:'AUTHOR_LABELS_UNAVAILABLE'});ok(true,'Lookup failure does not fall back to stale name');
 await assert.rejects(departedAuthorLabels({rpc:async()=>({data:[{actor_id:'a',public_name:null}],error:null})},['a']));ok(true,'Malformed attribution fails closed');
 ok((await departedAuthorLabels({rpc:async()=>{throw Error()}},[])).size===0,'Empty posts require no lookup');
 console.log('Completed '+n+' attribution/write-fence checks; synthetic only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
