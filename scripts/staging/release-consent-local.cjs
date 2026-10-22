/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto');
module.exports=async(c,r)=>{
 await c.query(fs.readFileSync('supabase/migrations/202610220028_release_consent.sql','utf8'));
 const ok=name=>r.checks.push({name:'Release consent: '+name,pass:true});
 const ids=Array.from({length:4},()=>randomUUID()),[owner,member,other,leaving]=ids;
 for(const id of ids)await c.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
 const as=async(role,id,sql,args=[],commit=false)=>{
  await c.query('BEGIN');try{await c.query('SET LOCAL ROLE '+role);await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id||'']);const result=await c.query(sql,args);await c.query(commit?'COMMIT':'ROLLBACK');return result}catch(e){await c.query('ROLLBACK');throw e}
 };
 const accept=(id,adult=true,terms='2026-10-22')=>as('authenticated',id,'SELECT mvp_accept_current_terms($1,$2,$3)',[terms,'2026-10-22',adult],true);
 for(const adult of [null,false]){await assert.rejects(accept(member,adult),/CONSENT_REQUIRED/);ok('Age '+adult+' denied without storing');}
 await assert.rejects(accept(member,true,'2026-03-24'),/CONSENT_REQUIRED/);ok('Previous terms not accepted');
 for(const role of ['anon','service_role']){await assert.rejects(as(role,null,"SELECT mvp_accept_current_terms('2026-10-22','2026-10-22',true)"),e=>e.code==='42501');ok(role+' cannot impersonate consent');}
 await assert.rejects(as('authenticated',member,"SELECT mvp_accept_current_terms('2026-03-24','2026-03-24')"),e=>e.code==='42501');ok('Old two-argument bypass retired');
 assert.equal((await c.query('SELECT adult_confirmed_at FROM profiles WHERE id=$1',[member])).rows[0].adult_confirmed_at,null);ok('No inferred age/backfill');
 await assert.rejects(as('authenticated',member,'UPDATE profiles SET adult_confirmed_at=now() WHERE id=$1',[member]),e=>e.code==='42501');ok('Direct attestation update denied');
 const settings={title:'TEST release consent',category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'};
 await assert.rejects(c.query('SELECT mvp_create_room($1,$2,$3)',[owner,randomUUID(),settings]),/CONSENT_REQUIRED/);ok('Creator cannot bypass account consent');
 await accept(owner);const room=(await c.query('SELECT mvp_create_room($1,$2,$3) id',[owner,randomUUID(),settings])).rows[0].id;
 await assert.rejects(c.query("SELECT mvp_join_member($1,$2,'2026-10-22')",[member,room]),/CONSENT_REQUIRED/);ok('Member needs account age confirmation');
 await accept(member);await accept(other);await accept(leaving);
 const self=await as('authenticated',member,'SELECT id,adult_confirmed_at,terms_version FROM profiles');assert.equal(self.rowCount,1);assert.equal(self.rows[0].id,member);assert(self.rows[0].adult_confirmed_at);ok('Only own server timestamp visible');
 await assert.rejects(as('anon',null,'SELECT adult_confirmed_at FROM profiles'),e=>e.code==='42501');ok('No anonymous attestation enumeration');
 await assert.rejects(c.query("SELECT mvp_join_member($1,$2,'2026-03-24')",[member,room]),/INVALID_INPUT/);ok('Old room publication consent denied');
 await c.query("SELECT mvp_join_member($1,$2,'2026-10-22')",[member,room]);
 const m=(await c.query('SELECT room_terms_version,room_agreed_at,forced_publish_ack_at FROM room_members WHERE room_id=$1 AND user_id=$2',[room,member])).rows[0];assert.equal(m.room_terms_version,'2026-10-22');assert(m.room_agreed_at&&m.forced_publish_ack_at);ok('Join stores publication version and server timestamps atomically');
 const request=(await c.query("SELECT mvp_request_core($1,$2,'2026-10-22') id",[member,room])).rows[0].id;
 await c.query("UPDATE room_join_requests SET room_terms_version='2026-03-24' WHERE id=$1",[request]);
 await assert.rejects(c.query('SELECT mvp_decide_core($1,$2,$3,true)',[owner,room,request]),/CONSENT_REQUIRED/);ok('Old pending Core request cannot silently promote');
 const fresh=(await c.query("SELECT mvp_request_core($1,$2,'2026-10-22') id",[member,room])).rows[0].id;assert.notEqual(fresh,request);
 await c.query('SELECT mvp_decide_core($1,$2,$3,true)',[owner,room,fresh]);assert.equal((await c.query('SELECT role FROM room_members WHERE room_id=$1 AND user_id=$2',[room,member])).rows[0].role,'core');ok('Fresh Core consent can be approved');
 await c.query('SELECT mvp_set_deletion_pause(false)');await c.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21')",[leaving]);await c.query('SELECT mvp_set_deletion_pause(true)');
 await assert.rejects(accept(leaving),/ACCOUNT_UNAVAILABLE/);ok('Withdrawal write stop remains enforced');
 const grants=(await c.query("SELECT has_function_privilege('authenticated','mvp_join_member(uuid,uuid,text)','EXECUTE') a,has_function_privilege('service_role','mvp_join_member(uuid,uuid,text)','EXECUTE') s,has_function_privilege('service_role','mvp_set_deletion_pause(boolean)','EXECUTE') p")).rows[0];assert.deepEqual(grants,{a:false,s:true,p:false});ok('Join ACL and owner-only pause unchanged');
};
