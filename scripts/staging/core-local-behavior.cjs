/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async(c,r)=>{
 const ok=(v,name)=>{assert.ok(v,name);r.checks.push({name,pass:true});};
 const ids=Array.from({length:9},()=>randomUUID()),[owner,...users]=ids;
 for(const id of ids)await c.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
 const settings={title:'SYNTHETIC CORE',category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'};
 const room=(await c.query('SELECT mvp_create_room($1,$2,$3) id',[owner,randomUUID(),settings])).rows[0].id;
 const join=async user=>c.query("SELECT mvp_join_member($1,$2,'2026-03-24')",[user,room]);
 const request=async user=>(await c.query("SELECT mvp_request_core($1,$2,'2026-03-24') id",[user,room])).rows[0].id;
 const decide=(id,approve=true,actor=owner,roomId=room)=>c.query('SELECT mvp_decide_core($1,$2,$3,$4)',[actor,roomId,id,approve]);
 await assert.rejects(request(users[0]),/MEMBER_REQUIRED/);ok(true,'Core request requires active Member');
 for(const id of users)await join(id);
 const id=await request(users[0]);
 ok(await request(users[0])===id,'Duplicate pending request returns one canonical request');
 await assert.rejects(decide(id,true,users[1]),/NOT_CREATOR/);ok(true,'Non-Creator approval rejected');
 await assert.rejects(decide(id,true,owner,randomUUID()),/REQUEST_NOT_FOUND/);ok(true,'Cross-room request rejected');
 await decide(id);await decide(id);
 const member=(await c.query('SELECT role,core_lock_agreed_at FROM room_members WHERE room_id=$1 AND user_id=$2',[room,users[0]])).rows[0];
 ok(member.role==='core'&&member.core_lock_agreed_at!==null,'Core approval and consent commit together, replay is harmless');
 await assert.rejects(request(users[0]),/MEMBER_REQUIRED/);ok(true,'Core cannot file another Member request');
 const left=await request(users[1]);await c.query('UPDATE room_members SET left_at=now() WHERE room_id=$1 AND user_id=$2',[room,users[1]]);
 await assert.rejects(decide(left),/STALE_MEMBERSHIP/);ok(true,'Departed Member cannot be revived by approval');
 await join(users[1]);await assert.rejects(decide(left),/STALE_MEMBERSHIP/);ok(true,'Rejoined membership cannot consume stale request');
 const refreshed=await request(users[1]);ok(refreshed!==left,'Explicit new request revokes stale membership snapshot');
 const kicked=await request(users[2]);await c.query("SELECT mvp_manage_member($1,$2,$3,'kick')",[owner,room,users[2]]);
 await assert.rejects(decide(kicked),/MEMBER_EXCLUDED/);await assert.rejects(join(users[2]),/MEMBER_EXCLUDED/);ok(true,'Kicked Member cannot be approved or rejoin');
 const gone=await request(users[3]);await c.query('DELETE FROM auth.users WHERE id=$1',[users[3]]);
 await assert.rejects(decide(gone),/REQUEST_NOT_FOUND/);ok(true,'Deleted Auth applicant cannot be approved');
 const invalid=await request(users[4]);
 await c.query('UPDATE rooms SET is_hidden=true WHERE id=$1',[room]);await assert.rejects(decide(invalid),/ROOM_UNAVAILABLE/);
 await c.query('UPDATE rooms SET is_hidden=false,deleted_at=now() WHERE id=$1',[room]);await assert.rejects(decide(invalid),/ROOM_UNAVAILABLE/);
 await c.query("UPDATE rooms SET deleted_at=null,status='forced_publish' WHERE id=$1",[room]);await assert.rejects(decide(invalid),/ROOM_UNAVAILABLE/);
 await c.query("UPDATE rooms SET status='open' WHERE id=$1",[room]);ok(true,'Hidden/deleted/published room approval denied');
 const withdrawn=await request(users[5]);await c.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21')",[users[5]]);
 await assert.rejects(decide(withdrawn),/ACCOUNT_WITHDRAWAL_PENDING/);ok(true,'Withdrawing Member approval denied');
 await decide(invalid,false);await decide(invalid,false);await assert.rejects(decide(invalid),/NOT_PENDING/);ok(true,'Rejected request cannot be approved, same rejection replays');
 for(let i=0;i<2;i++)await decide(await request(users[4]),false);
 await assert.rejects(request(users[4]),/REQUEST_LIMIT/);ok(true,'Three-request cap and one-pending invariant enforced');
 for(const role of ['anon','authenticated','service_role']){
  const row=(await c.query("SELECT has_function_privilege($1,'approve_core_request(uuid,uuid,uuid)','EXECUTE') x",[role])).rows[0];
  ok(!row.x,'Retired approval denied to '+role);
 }
 // Force a consent-trigger failure: whole RPC must roll back both role and decision.
 const fail=await request(users[6]);
 await c.query("CREATE FUNCTION synthetic_core_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.role='core' THEN RAISE EXCEPTION 'SYNTHETIC_FAIL'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_core_failure BEFORE UPDATE ON room_members FOR EACH ROW EXECUTE FUNCTION synthetic_core_failure()");
 await assert.rejects(decide(fail),/SYNTHETIC_FAIL/);
 ok((await c.query('SELECT status FROM room_join_requests WHERE id=$1',[fail])).rows[0].status==='pending'&&(await c.query('SELECT role FROM room_members WHERE room_id=$1 AND user_id=$2',[room,users[6]])).rows[0].role==='supporter','Injected failure rolls back decision and promotion');
 await c.query('DROP TRIGGER synthetic_core_failure ON room_members; DROP FUNCTION synthetic_core_failure()');
};
