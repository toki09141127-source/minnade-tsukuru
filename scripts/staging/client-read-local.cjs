/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async(c,r)=>{
 const ok=name=>r.checks.push({name,pass:true});
 const [owner,member,outsider]=[randomUUID(),randomUUID(),randomUUID()];
 for(const id of [owner,member,outsider]){
  await c.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
  await c.query('INSERT INTO public_profiles(id,username) SELECT id,username FROM profiles WHERE id=$1',[id]);
 }
 const room=(await c.query('SELECT mvp_create_room($1,$2,$3) id',[owner,randomUUID(),{title:'SYNTHETIC ACL',category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'}])).rows[0].id;
 await c.query("SELECT mvp_join_member($1,$2,'2026-03-24')",[member,room]);
 await c.query("INSERT INTO posts(room_id,user_id,content) VALUES($1,$2,'SYNTHETIC PRIVATE')",[room,member]);
 const as=async(role,id,sql,args=[])=>{
  await c.query('BEGIN');try{await c.query('SET LOCAL ROLE '+role);await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id||'']);return await c.query(sql,args)}finally{await c.query('ROLLBACK')}
 };
 const own=await as('authenticated',member,'SELECT id,username,terms_version FROM profiles');assert.equal(own.rows.length,1);assert.equal(own.rows[0].id,member);ok('Authenticated profile read is self-only');
 await assert.rejects(as('anon',null,'SELECT username FROM profiles'),e=>e.code==='42501');ok('Anon private profiles denied');
 await assert.rejects(as('authenticated',member,'SELECT deleted_at FROM profiles'),e=>e.code==='42501');ok('Internal deletion state column denied');
 await assert.rejects(as('authenticated',member,"UPDATE profiles SET bio='bad'"),e=>e.code==='42501');ok('Direct profile UPDATE denied');
 await assert.rejects(as('authenticated',member,'DELETE FROM profiles'),e=>e.code==='42501');ok('Direct profile DELETE denied');
 await as('authenticated',member,"SELECT mvp_accept_current_terms('2026-03-24','2026-03-24')");ok('Self consent RPC executes with no actor parameter');
 await assert.rejects(as('authenticated',member,"SELECT mvp_accept_current_terms('wrong','2026-03-24')"));ok('Wrong consent version denied');
 const mem=await as('authenticated',member,'SELECT user_id,role,last_seen_at FROM room_members');assert.equal(mem.rows.length,1);assert.equal(mem.rows[0].user_id,member);ok('Membership read contains only self');
 await assert.rejects(as('anon',null,'SELECT user_id FROM room_members'),e=>e.code==='42501');ok('Anon cannot enumerate membership identities');
 await assert.rejects(as('authenticated',member,"UPDATE room_members SET role='creator'"),e=>e.code==='42501');ok('Direct role escalation denied');
 await assert.rejects(as('authenticated',member,'UPDATE room_members SET last_seen_at=now()'),e=>e.code==='42501');ok('last_seen does not open arbitrary table UPDATE');
 const list=await as('anon',null,'SELECT id,member_count FROM mvp_room_list WHERE id=$1',[room]);assert.equal(list.rows[0].member_count,'2');ok('Public listing has aggregate count without member SELECT');
 await assert.rejects(as('anon',null,'SELECT host_ids FROM mvp_room_list'));ok('Listing has no internal host projection');
 await assert.rejects(as('anon',null,'SELECT * FROM rooms_with_counts_v2'));ok('Legacy broad view denied');
 assert.equal((await as('authenticated',outsider,'SELECT content FROM posts WHERE room_id=$1',[room])).rowCount,0);ok('Nonmember private post REST denied');
 assert.equal((await as('authenticated',member,'SELECT content FROM posts WHERE room_id=$1',[room])).rowCount,1);ok('Member post reader works under RLS');
 await c.query('UPDATE room_members SET left_at=now() WHERE room_id=$1 AND user_id=$2',[room,member]);
 assert.equal((await as('authenticated',member,'SELECT left_at FROM room_members WHERE room_id=$1',[room])).rowCount,1);ok('Departed member can inspect own state');
 assert.equal((await as('authenticated',member,'SELECT content FROM posts WHERE room_id=$1',[room])).rowCount,0);ok('Departed member loses private posts');
 await c.query('UPDATE rooms SET is_hidden=true WHERE id=$1',[room]);
 assert.equal((await as('anon',null,'SELECT id FROM mvp_room_list WHERE id=$1',[room])).rowCount,0);ok('Hidden room excluded from listing');
 assert.equal((await as('anon',null,'SELECT mvp_visible_member_count($1) n',[room])).rows[0].n,'0');ok('Count helper discloses no hidden-room membership');
 await c.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21')",[member]);
 assert.equal((await as('authenticated',member,'SELECT id FROM profiles')).rowCount,0);ok('Withdrawing JWT cannot read private profile');
 await assert.rejects(as('authenticated',member,"SELECT mvp_accept_current_terms('2026-03-24','2026-03-24')"),/ACCOUNT_UNAVAILABLE/);ok('Withdrawing JWT cannot recreate consent/profile');
 const name=(await c.query('SELECT username FROM profiles WHERE id=$1',[member])).rows[0].username;
 assert.equal((await as('anon',null,'SELECT username FROM public_profiles WHERE username=$1',[name])).rowCount,0);ok('Anonymized public profile not exposed');
};

