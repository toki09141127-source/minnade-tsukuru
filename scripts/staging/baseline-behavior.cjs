/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async(c,r)=>{
 const ok=(name,pass)=>{assert.ok(pass,name);r.checks.push({name,pass:true});};
 const ids=Array.from({length:7},()=>randomUUID()),[owner,member,operator,...reporters]=ids;
 for(let i=0;i<ids.length;i++){
  await c.query('INSERT INTO auth.users(id) VALUES($1)',[ids[i]]);
  await c.query('INSERT INTO profiles(id,username) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET username=excluded.username',[ids[i],'synthetic'+i]);
  await c.query('INSERT INTO public_profiles(id,username) VALUES($1,$2)',[ids[i],'synthetic'+i]);
 }
 const settings={title:'SYNTHETIC ONLY',category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'};
 const room=(await c.query('SELECT mvp_create_room($1,$2,$3) id',[owner,randomUUID(),settings])).rows[0].id;
 ok('room creation with audited DEFAULT/CHECK/Trigger succeeds',!!room);
 const join=async(id)=>c.query("SELECT mvp_join_member($1,$2,'2026-03-24')",[id,room]);
 await join(member);
 const request=randomUUID();
 await c.query("INSERT INTO room_join_requests(id,room_id,user_id) VALUES($1,$2,$3)",[request,room,member]);
 await c.query('UPDATE room_members SET left_at=now() WHERE room_id=$1 AND user_id=$2',[room,member]);
 await c.query('SELECT approve_core_request($1,$2,$3)',[room,owner,request]);
 const revived=(await c.query('SELECT role,left_at,core_lock_agreed_at FROM room_members WHERE room_id=$1 AND user_id=$2',[room,member])).rows[0];
 ok('known issue reproduced: old approval revives departed member without core consent',revived.role==='core'&&revived.left_at===null&&revived.core_lock_agreed_at===null);
 r.knownIssues=[{priority:'P1',code:'LEGACY_CORE_REVIVAL_AND_NONATOMIC_CONSENT',reproduced:true}];
 for(const id of reporters)await join(id);
 const post=(await c.query("INSERT INTO posts(room_id,user_id,content) VALUES($1,$2,'SYNTHETIC') RETURNING id",[room,owner])).rows[0].id;
 for(const id of reporters.slice(0,3))await c.query("SELECT * FROM mvp_receive_report($1,$2,'post',$3,'synthetic')",[id,randomUUID(),post]);
 ok('actual auto-hide Trigger hides post after three accepted reports',(await c.query('SELECT is_hidden FROM posts WHERE id=$1',[post])).rows[0].is_hidden);
 const post2=(await c.query("INSERT INTO posts(room_id,user_id,content) VALUES($1,$2,'SYNTHETIC pending') RETURNING id",[room,owner])).rows[0].id;
 for(const id of reporters.slice(0,2))await c.query("SELECT * FROM mvp_receive_report($1,$2,'post',$3,'synthetic')",[id,randomUUID(),post2]);
 // A colliding internal name must fail without a partial rename/job.
 const collision='r_'+require('node:crypto').createHash('md5').update(owner).digest('hex').slice(0,18);
 await c.query('UPDATE profiles SET username=$1 WHERE id=$2',[collision,operator]);
 await assert.rejects(c.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21')",[owner]),e=>e.code==='23505');
 ok('internal-name collision rolls back profile and job atomically',
  (await c.query('SELECT username FROM profiles WHERE id=$1',[owner])).rows[0].username==='synthetic0'&&
  (await c.query('SELECT count(*)::int n FROM account_deletion_jobs WHERE actor_id=$1',[owner])).rows[0].n===0);
 await c.query("UPDATE profiles SET username='synthetic2' WHERE id=$1",[operator]);
 await c.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21')",[owner]);
 ok('anonymous internal name fits audited 20-character limit',(await c.query('SELECT username FROM profiles WHERE id=$1',[owner])).rows[0].username.length<=20);

 const key=randomUUID();
 const receipt=(await c.query("SELECT * FROM mvp_receive_report($1,$2,'post',$3,'synthetic')",[reporters[2],key,post2])).rows[0];
 ok('actual Trigger blocked by withdrawal preserves pending receipt',receipt.processing_state==='pending');
 ok('failed auto-hide leaves target unchanged',!(await c.query('SELECT is_hidden FROM posts WHERE id=$1',[post2])).rows[0].is_hidden);
 const retry=(await c.query("SELECT * FROM mvp_receive_report($1,$2,'post',$3,'synthetic')",[reporters[2],key,post2])).rows[0];
 ok('pending retry returns same receipt without legacy insert',retry.receipt_id===receipt.receipt_id&&(await c.query('SELECT count(*)::int n FROM reports WHERE target_id=$1',[post2])).rows[0].n===2);
 await c.query('INSERT INTO moderation_operators(user_id) VALUES($1)',[operator]);
 await c.query("SELECT mvp_moderate($1,'post',$2,'other',true,$3)",[operator,post2,randomUUID()]);
 ok('scoped moderator hide remains compatible with audited edit timestamp Trigger',(await c.query('SELECT is_hidden FROM posts WHERE id=$1',[post2])).rows[0].is_hidden);
 await assert.rejects(c.query("UPDATE posts SET content='blocked' WHERE id=$1",[post2]));
 ok('ordinary writes to departing author remain blocked',true);
 const grants=(await c.query("SELECT has_function_privilege('anon','approve_core_request(uuid,uuid,uuid)','EXECUTE') a,has_function_privilege('authenticated','approve_core_request(uuid,uuid,uuid)','EXECUTE') u")).rows[0];
 ok('005 removes direct anon/authenticated legacy approval access',!grants.a&&!grants.u);
};
