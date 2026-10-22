/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async(c,r)=>{
 const ok=(name)=>r.checks.push({name,pass:true});
 const [owner,member]=[randomUUID(),randomUUID()];
 for(const id of [owner,member]){
  await c.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
  await c.query("UPDATE profiles SET bio='synthetic bio',website_url='synthetic link' WHERE id=$1",[id]);
  await c.query("INSERT INTO public_profiles(id,username,bio,avatar_url,links) SELECT id,username,'synthetic bio','synthetic avatar','{}'::jsonb FROM profiles WHERE id=$1 ON CONFLICT(id) DO UPDATE SET bio=excluded.bio,avatar_url=excluded.avatar_url,links=excluded.links",[id]);
 }
 const settings={title:'SYNTHETIC DELETION',category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'};
 const room=(await c.query('SELECT mvp_create_room($1,$2,$3) id',[owner,randomUUID(),settings])).rows[0].id;
 const request=async id=>(await c.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21') id",[id])).rows[0].id;
 await assert.rejects(request(owner),/UNPUBLISHED_CREATOR_ROOMS/);
 assert.equal((await c.query('SELECT bio FROM profiles WHERE id=$1',[owner])).rows[0].bio,'synthetic bio');
 assert.equal((await c.query('SELECT count(*)::int n FROM account_deletion_jobs WHERE actor_id=$1',[owner])).rows[0].n,0);ok('Unpublished Creator refusal leaves profile and jobs unchanged');
 await c.query("SELECT mvp_join_member($1,$2,'2026-03-24')",[member,room]);
 await c.query("INSERT INTO posts(room_id,user_id,content) VALUES($1,$2,'SYNTHETIC RETAIN')",[room,member]);
 await assert.rejects(c.query("SELECT mvp_request_deletion($1,'keep_name','withdrawal-draft-2026-10-21')",[member]),/INVALID_INPUT/);ok('New withdrawal accepts fixed anonymous policy only');
 const job=await request(member);assert.equal(await request(member),job);ok('Anonymous request retry returns same durable job');
 const row=(await c.query('SELECT bio,website_url,deleted_at FROM profiles WHERE id=$1',[member])).rows[0];
 assert.equal(row.bio,null);assert.equal(row.website_url,null);assert.ok(row.deleted_at);
 const pub=(await c.query('SELECT bio,avatar_url,links FROM public_profiles WHERE id=$1',[member])).rows[0];
 assert.deepEqual(pub,{bio:null,avatar_url:null,links:null});ok('Audited profile and public profile PII cleared atomically');
 assert.equal((await c.query('SELECT content FROM posts WHERE room_id=$1 AND user_id=$2',[room,member])).rows[0].content,'SYNTHETIC RETAIN');ok('Shared contribution retained');
 await assert.rejects(c.query("UPDATE profiles SET bio='reintroduced' WHERE id=$1",[member]),/ACCOUNT_WITHDRAWAL_PENDING/);ok('Withdrawal write fence still prevents profile rewrite');
 await assert.rejects(c.query('DELETE FROM auth.users WHERE id=$1',[member]));
 assert.equal((await c.query('SELECT count(*)::int n FROM auth.users WHERE id=$1',[member])).rows[0].n,1);ok('Unreconciled Auth deletion fails safely; no completion claim');
 for(const role of ['anon','authenticated','service_role']){
  assert.equal((await c.query("SELECT has_function_privilege($1,'mvp_request_deletion_before_privacy(uuid,text,text)','EXECUTE') x",[role])).rows[0].x,false);
 }ok('Internal pre-privacy request denied to every application role');
};

