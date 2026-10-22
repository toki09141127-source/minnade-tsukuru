/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),{PGlite}=require('@electric-sql/pglite');
let n=0;const ok=(v,label)=>{assert.ok(v,label);console.log(++n+'. '+label);};
function load(file){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,Buffer,Uint8Array,require:name=>name==='sharp'?require('sharp'):load('lib/'+name.replace('./','')+'.ts')});return mod.exports;}
(async()=>{
 const {resumeAccountDeletion}=load('lib/accountDeletion.ts');
 for(const failAt of ['none','prepare','lookup','delete','finalize','record']) {
  let stage='requested',exists=true,deletes=0,fail=true,claimed=false;
  const ports={
   claim:async()=>{if(claimed)return null;claimed=true;return {id:'job',actorId:'owner',stage,lease:'lease'};},
   prepare:async()=>{if(failAt==='prepare'&&fail){fail=false;throw Error();}return 'prepared';},
   authExists:async()=>{if(failAt==='lookup'&&fail){fail=false;throw Error();}return exists;},
   deleteAuth:async()=>{deletes++;exists=false;if(failAt==='delete'&&fail){fail=false;throw Error();}},
   finalize:async()=>{if(failAt==='finalize'&&fail){fail=false;return false;}return true;},
   advance:async(job,next)=>{assert.equal(job.stage,stage);if(failAt==='record'&&next==='auth_deleted'&&fail){fail=false;throw Error();}stage=next;},
   release:async()=>{claimed=false;}
  };
  const first=await resumeAccountDeletion('job',ports);
  ok(first===(failAt==='none'?'completed':'retry'),'Deletion first result '+failAt);
  const retry=await resumeAccountDeletion('job',ports);
  ok(retry==='completed'&&!exists&&deletes===1,'Deletion resumes without duplicate external deletion '+failAt);
 }
 let external=false;
 const stopped={claim:async()=>({id:'j',actorId:'a',stage:'requested',lease:'l'}),prepare:async()=>'needs_review',
  advance:async()=>{},release:async()=>{},authExists:async()=>{external=true;return true;},deleteAuth:async()=>{external=true;},finalize:async()=>true};
 ok(await resumeAccountDeletion('j',stopped)==='needs_review'&&!external,'Review requirement never reaches Auth');
 ok(await resumeAccountDeletion('j',{...stopped,claim:async()=>null})==='busy','Busy lease prevents duplicate worker');
 const safety=load('lib/publicationSafety.ts');
 for(const text of ['person@example.test','090-1234-5678','〒123-4567','@private_handle']) ok(safety.piiSignals(text).length>0,'PII deterministic signal');
 const base={id:'log',roomId:'room',content:'制作を進めよう',hidden:false,deleted:false,excluded:false,reviewed:true};
 for(const changes of [{hidden:true},{deleted:true},{excluded:true},{reviewed:false},{roomId:'other'},{content:'a@example.test'}])
  ok(safety.safePublicLogs('room',[{...base,...changes}]).length===0,'Unsafe log excluded');
 ok(safety.safePublicLogs('room',[base]).length===1,'Reviewed clean log retained');
 const result=await safety.buildCompletion('room',[base],[],{summarize:async()=>{throw Error('provider');}});
 ok(result.generated===false&&result.blocks[0].text.includes('未確定'),'No provider fallback invents no content');
 const pii=await safety.buildCompletion('room',[base],[],{summarize:async()=>[{id:'x',kind:'text',text:'a@example.test'}]});
 ok(pii.generated===false,'Generated PII fails closed');


 const sharp=require('sharp');
 const source=await sharp({create:{width:8,height:8,channels:3,background:'#336699'}})
  .jpeg().withExif({IFD0:{Artist:'PRIVATE_FIXTURE'}}).toBuffer();
 const {sanitizeImage}=load('lib/imagePrivacy.ts');
 const sanitized=await sanitizeImage(new Uint8Array(source),'image/jpeg');
 const meta=await sharp(Buffer.from(sanitized)).metadata();
 ok(!meta.exif&&!meta.xmp&&!meta.iptc,'Image EXIF/XMP/IPTC removed after re-encode');
 ok(meta.width===8&&meta.height===8,'Image dimensions retained');
 await assert.rejects(sanitizeImage(new Uint8Array([255,216,255]),'image/jpeg'));
 ok(true,'Truncated image rejected by decoder');
 const db=new PGlite();
 try{
 const creator='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222',room='33333333-3333-4333-8333-333333333333';
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE rooms(id uuid primary key,created_by uuid,status text,is_hidden boolean,deleted_at timestamptz,expires_at timestamptz);
 CREATE TABLE posts(id uuid PRIMARY KEY,room_id uuid,content text DEFAULT '合成ログ',attachment_url text,attachment_type text,is_hidden boolean NOT NULL DEFAULT false,deleted_at timestamptz,is_marked boolean DEFAULT false,marked_by uuid,marked_at timestamptz);
 CREATE TABLE room_join_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),room_id uuid,user_id uuid,status text);
 CREATE TABLE room_members(id uuid primary key default gen_random_uuid(),room_id uuid references rooms,user_id uuid,role text,is_core boolean,left_at timestamptz,unique(room_id,user_id));
 INSERT INTO rooms VALUES('${room}','${creator}','open',false,null,null);
 INSERT INTO room_members(room_id,user_id,role,is_core) VALUES('${room}','${creator}','creator',true),('${room}','${target}','core',true);`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202610210002_membership_guards.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202610210003_account_jobs.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202610210004_moderation.sql'),'utf8'));
 await assert.rejects(db.query('SELECT mvp_manage_member($1,$2,$3,$4)',[target,room,creator,'kick']));
 ok(true,'Noncreator cannot kick');
 await db.query('SELECT mvp_manage_member($1,$2,$3,$4)',[creator,room,target,'demote']);
 ok((await db.query('SELECT role,is_core,left_at FROM room_members WHERE user_id=$1',[target])).rows[0].role==='supporter','Demotion retains membership');
 await db.query('SELECT mvp_manage_member($1,$2,$3,$4)',[creator,room,target,'kick']);
 ok((await db.query('SELECT left_at FROM room_members WHERE user_id=$1',[target])).rows[0].left_at!==null,'Kick terminates membership without deleting');
 await assert.rejects(db.query('UPDATE room_members SET left_at=NULL WHERE user_id=$1',[target]));
 ok(true,'Kicked rejoin denied at DB trigger');
 await assert.rejects(db.query("INSERT INTO room_join_requests(room_id,user_id,status) VALUES($1,$2,'pending')",[room,target]));
 ok(true,'Kicked Core request denied');
 await db.query('INSERT INTO posts(id,room_id) VALUES($1,$2)',[target,room]);
 await assert.rejects(db.query('SELECT mvp_highlight($1,$2,$3,false)',[target,room,target]));
 ok(true,'Kicked member cannot highlight');
 await db.query('SELECT mvp_highlight($1,$2,$3,false)',[creator,room,target]);
 ok((await db.query('SELECT is_marked FROM posts')).rows[0].is_marked,'Creator atomic highlight succeeds');
 await assert.rejects(db.query('SELECT mvp_highlight($1,$2,$3,false)',[creator,room,target]));
 ok(true,'Stale highlight write conflicts');

 await db.query("UPDATE rooms SET status='forced_publish'");
 await assert.rejects(db.query('SELECT mvp_manage_member($1,$2,$3,$4)',[creator,room,target,'demote']));
 ok(true,'Published room management denied');

 await assert.rejects(db.query("SELECT mvp_moderate($1,'room',$2,'privacy',true,$3)",[creator,room,target]));
 ok(true,'Creator is not automatically a moderation operator');
 await db.query('INSERT INTO moderation_operators VALUES($1)',[creator]);
 await db.query("SELECT mvp_moderate($1,'room',$2,'privacy',true,$3)",[creator,room,target]);
 ok((await db.query('SELECT is_hidden FROM rooms')).rows[0].is_hidden===true,'Operator can hide published work');
 await db.query("SELECT mvp_moderate($1,'room',$2,'privacy',true,$3)",[creator,room,target]);
 ok((await db.query('SELECT request_id FROM moderation_actions')).rows.length===1,'Moderation replay creates one audit event');
 await assert.rejects(db.query("SELECT mvp_moderate($1,'room',$2,'privacy',false,$3)",[creator,room,target]));
 ok(true,'Moderation key cannot change action on retry');
 await db.query("UPDATE rooms SET status='open',is_hidden=false");
 for(let i=4;i<=7;i++) await db.query("INSERT INTO room_members(room_id,user_id,role,is_core) VALUES($1,$2,'core',true)",[room,'00000000-0000-4000-8000-00000000000'+i]);
 await assert.rejects(db.query("INSERT INTO room_members(room_id,user_id,role,is_core) VALUES($1,$2,'core',true)",[room,'00000000-0000-4000-8000-000000000008']));
 ok(true,'Core maximum is four besides Creator');
 const request=(await db.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21') AS id",[creator])).rows[0].id;
 ok((await db.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21') AS id",[creator])).rows[0].id===request,'Deletion intake is idempotent');
 await assert.rejects(db.query("SELECT mvp_request_deletion($1,'keep_name','withdrawal-draft-2026-10-21')",[creator]));
 ok(true,'Deletion retry cannot silently change attribution consent');
 const job=(await db.query("INSERT INTO account_deletion_jobs(actor_id,attribution,policy_version) VALUES($1,'anonymous','draft') RETURNING id",[target])).rows[0].id;
 const claim=(await db.query('SELECT * FROM mvp_claim_deletion($1)',[job])).rows[0];
 ok((await db.query('SELECT * FROM mvp_claim_deletion($1)',[job])).rows.length===0,'Durable lease excludes duplicate claim');
 await assert.rejects(db.query("SELECT mvp_advance_deletion($1,$2,'requested','completed')",[job,claim.lease_token]));
 ok(true,'Cannot skip deletion stages');
 await assert.rejects(db.query("SELECT mvp_advance_deletion($1,$2,'requested','prepared')",[job,creator]));
 ok(true,'Wrong lease cannot advance');
 await db.query("SELECT mvp_advance_deletion($1,$2,'requested','prepared')",[job,claim.lease_token]);
 ok((await db.query('SELECT stage FROM account_deletion_jobs WHERE id=$1',[job])).rows[0].stage==='prepared','Durable stage transition');
 for(const role of ['anon','authenticated']) {
  await db.exec('SET ROLE '+role);
  await assert.rejects(db.query('SELECT * FROM account_deletion_jobs'));
  await assert.rejects(db.query('SELECT mvp_manage_member($1,$2,$3,$4)',[creator,room,target,'kick']));
  await db.exec('RESET ROLE');ok(true,'Untrusted role denied jobs and management RPC '+role);
 }

 await db.exec(`CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
 GRANT USAGE ON SCHEMA auth TO anon,authenticated;
 ALTER TABLE rooms ADD COLUMN core_invite_code text DEFAULT 'private-fixture';
 GRANT SELECT,UPDATE ON rooms,room_members,posts TO anon,authenticated;
 CREATE POLICY original_rooms_all ON rooms FOR SELECT USING(true);
 CREATE POLICY original_posts_all ON posts FOR SELECT USING(true);
 CREATE POLICY original_members_all ON room_members FOR SELECT USING(true);
 CREATE FUNCTION public.legacy_actor(p_actor uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS 'SELECT p_actor';`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202610210005_read_boundaries.sql'),'utf8'));
 await db.exec('SET ROLE anon');
 ok((await db.query('SELECT id FROM posts')).rows.length===0,'Restrictive boundary overrides unconditional SELECT for private posts');
 await assert.rejects(db.query('SELECT core_invite_code FROM rooms'));
 ok(true,'Invite secret column is not public');
 await assert.rejects(db.query('SELECT legacy_actor($1)',[creator]));
 ok(true,'Existing SECURITY DEFINER actor RPC is not public');
 await assert.rejects(db.query("UPDATE room_members SET role='creator'"));
 ok(true,'Direct role escalation denied by grants');
 await db.exec('RESET ROLE');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[creator]);
 await db.exec('SET ROLE authenticated');
 ok((await db.query('SELECT id FROM posts')).rows.length===1,'Active Creator retains private post read');
 await db.exec('RESET ROLE');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[target]);
 await db.exec('SET ROLE authenticated');
 ok((await db.query('SELECT id FROM posts')).rows.length===0,'Kicked participant cannot read private posts');
 await db.exec('RESET ROLE');
 await db.query("UPDATE rooms SET status='forced_publish'");
 await db.exec('SET ROLE anon');
 ok((await db.query('SELECT id FROM posts')).rows.length===1,'Published visible posts remain readable');
 await db.exec('RESET ROLE');
 await db.query('UPDATE rooms SET is_hidden=true');
 await db.exec('SET ROLE anon');
 ok((await db.query('SELECT id FROM posts')).rows.length===0,'Hidden work cannot leak posts through permissive policy');
 await db.exec('RESET ROLE');

 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202610210006_work_drafts.sql'),'utf8'));
 await db.query("UPDATE rooms SET status='open',is_hidden=false,expires_at=clock_timestamp()+interval '1 hour'");
 const blocks=JSON.stringify([{id:'body',kind:'text',text:'合成作品の本文'}]);
 await assert.rejects(db.query('SELECT mvp_save_draft($1,$2,0,$3)',[target,room,blocks]));
 ok(true,'Kicked participant cannot edit completion draft');
 ok((await db.query('SELECT mvp_save_draft($1,$2,0,$3) AS v',[creator,room,blocks])).rows[0].v===1,'Creator saves draft with version');
 await assert.rejects(db.query('SELECT mvp_save_draft($1,$2,0,$3)',[creator,room,blocks]));
 ok(true,'Stale draft version cannot overwrite another edit');
 await assert.rejects(db.query('SELECT mvp_save_draft($1,$2,1,$3)',[creator,room,JSON.stringify([{kind:'html',text:'unsafe'}])]));
 ok(true,'Unsupported block structure rejected');
 const hash=(await db.query("SELECT encode(sha256(convert_to(octet_length(coalesce(content,''))::text||':'||coalesce(content,'')||octet_length(coalesce(attachment_url,''))::text||':'||coalesce(attachment_url,'')||octet_length(coalesce(attachment_type,''))::text||':'||coalesce(attachment_type,''),'UTF8')),'hex') AS h FROM posts WHERE id=$1",[target])).rows[0].h;
 await assert.rejects(db.query('SELECT mvp_review_log($1,$2,$3,true,$4)',[target,room,target,hash]));
 ok(true,'Kicked user cannot approve publication');
 await db.query('SELECT mvp_review_log($1,$2,$3,true,$4)',[creator,room,target,hash]);
 ok(true,'Creator can approve exact reviewed log content');
 await db.query("UPDATE rooms SET expires_at=clock_timestamp()-interval '1 second'");
 await assert.rejects(db.query('SELECT mvp_save_draft($1,$2,1,$3)',[creator,room,blocks]));
 ok(true,'Deadline rejects edits even before cron runs');
 await db.query("INSERT INTO rooms(id,created_by,status,is_hidden,expires_at) VALUES($1,$2,'open',false,clock_timestamp()-interval '1 second')",[target,creator]);
 ok((await db.query('SELECT mvp_publish_due() AS count')).rows[0].count===2,'Deadline publication freezes draft and missing-draft fallback');
 ok((await db.query('SELECT mvp_publish_due() AS count')).rows[0].count===0,'Repeated publication is idempotent');
 ok((await db.query('SELECT blocks FROM work_drafts WHERE room_id=$1',[target])).rows[0].blocks[0].text.includes('未確定'),'Incomplete publication has explicit non-fabricated fallback');
 await assert.rejects(db.query('SELECT mvp_save_draft($1,$2,1,$3)',[creator,room,blocks]));
 ok(true,'Published completion cannot be edited');

 ok((await db.query('SELECT mvp_public_post_allowed($1) AS allowed',[target])).rows[0].allowed===true,'Approved unchanged log is public');
 await db.query("UPDATE posts SET attachment_url='rooms/changed/image.png' WHERE id=$1",[target]);
 ok((await db.query('SELECT mvp_public_post_allowed($1) AS allowed',[target])).rows[0].allowed===false,'Changed attachment invalidates public approval');
 await db.query('UPDATE posts SET attachment_url=NULL WHERE id=$1',[target]);
 await db.query("UPDATE posts SET content='変更された本文' WHERE id=$1",[target]);
 ok((await db.query('SELECT mvp_public_post_allowed($1) AS allowed',[target])).rows[0].allowed===false,'Changed content invalidates previous public approval');
 await db.exec('SET ROLE anon');
 ok((await db.query('SELECT id FROM posts')).rows.length===0,'Unreviewed content blocked at direct SELECT boundary');
 await db.exec('RESET ROLE');
 }finally{await db.close();}
 console.log('Completed '+n+' completion checks; synthetic/local only.');
})().catch(error=>{console.error(error);process.exitCode=1;});
