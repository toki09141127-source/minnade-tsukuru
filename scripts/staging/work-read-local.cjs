/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async(c,r)=>{
 const ok=name=>r.checks.push({name,pass:true});
 const [owner,member,outsider]=[randomUUID(),randomUUID(),randomUUID()];
 for(const id of [owner,member,outsider])await c.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
 const room=(await c.query('SELECT mvp_create_room($1,$2,$3) id',[owner,randomUUID(),{title:'SYNTHETIC SNAPSHOT',category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'}])).rows[0].id;
 await c.query("SELECT mvp_join_member($1,$2,'2026-03-24')",[member,room]);
 await c.query("SELECT mvp_save_draft($1,$2,0,$3)",[owner,room,JSON.stringify([{id:'test',kind:'text',text:'SYNTHETIC WORK'}])]);
 const as=async(role,id,sql,args=[])=>{await c.query('BEGIN');try{await c.query('SET LOCAL ROLE '+role);await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id||'']);return await c.query(sql,args)}finally{await c.query('ROLLBACK')}};
 const read=(role,id)=>as(role,id,'SELECT blocks FROM work_drafts WHERE room_id=$1',[room]);
 assert.equal((await read('anon',null)).rowCount,0);ok('Anon unpublished draft excluded without membership ACL error');
 assert.equal((await read('authenticated',outsider)).rowCount,0);ok('Nonmember unpublished draft excluded');
 assert.equal((await read('authenticated',member)).rowCount,1);ok('Active member reads draft');
 await c.query('UPDATE room_members SET left_at=now() WHERE room_id=$1 AND user_id=$2',[room,member]);
 assert.equal((await read('authenticated',member)).rowCount,0);ok('Left member loses unpublished draft');
 await c.query("UPDATE rooms SET expires_at=now()-interval '1s' WHERE id=$1",[room]);
 await c.query('SELECT mvp_publish_due()');
 assert.equal((await read('anon',null)).rowCount,1);ok('Anon reads published snapshot without membership identity access');
 await assert.rejects(as('anon',null,'SELECT updated_by FROM work_drafts'),e=>e.code==='42501');ok('Public snapshot updater identity denied');
 await assert.rejects(as('authenticated',member,"UPDATE work_drafts SET blocks='[]'"),e=>e.code==='42501');ok('Direct draft writes denied');
 await c.query('UPDATE rooms SET is_hidden=true WHERE id=$1',[room]);
 assert.equal((await read('anon',null)).rowCount,0);ok('Hidden published snapshot denied');
 await c.query('UPDATE rooms SET is_hidden=false,deleted_at=now() WHERE id=$1',[room]);
 assert.equal((await read('anon',null)).rowCount,0);ok('Deleted published snapshot denied');
 await c.query('UPDATE rooms SET deleted_at=null WHERE id=$1',[room]);
 await c.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21')",[member]);
 assert.equal((await read('authenticated',member)).rowCount,0);ok('Withdrawing JWT snapshot denied');
 // Prove final Auth deletion is unsafe with the actual audited triggers, in a rolled-back transaction.
 await c.query('BEGIN');try{
 await assert.rejects(c.query('DELETE FROM auth.users WHERE id=$1',[member]),/ACCOUNT_WITHDRAWAL_PENDING/);
 }finally{await c.query('ROLLBACK')}
 assert.equal((await c.query('SELECT id FROM auth.users WHERE id=$1',[member])).rowCount,1);ok('Auth cascade collides with write fence; unsafe deletion rolls back');
};

