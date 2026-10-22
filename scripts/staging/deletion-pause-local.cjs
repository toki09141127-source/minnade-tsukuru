/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('node:fs');
module.exports=async(c,r)=>{
 await c.query(fs.readFileSync('supabase/migrations/202610220027_deletion_pause.sql','utf8'));
 const ok=name=>r.checks.push({name:'Pause: '+name,pass:true});
 const req=id=>c.query("SELECT mvp_request_deletion($1,'anonymous','withdrawal-draft-2026-10-21') id",[id]);
 const pause=b=>c.query('SELECT mvp_set_deletion_pause($1)',[b]);
 const snapshot=async()=> (await c.query('SELECT mvp_deletion_operations() s')).rows[0].s;
 const actor=randomUUID();await c.query('INSERT INTO auth.users(id) VALUES($1)',[actor]);
 assert.equal((await snapshot()).paused,true);await assert.rejects(req(actor),/DELETION_PAUSED/);ok('A default pause denies new request');
 for(const role of ['anon','authenticated','service_role']){
  await c.query('BEGIN');try{await c.query('SET LOCAL ROLE '+role);await assert.rejects(pause(false),e=>e.code==='42501')}finally{await c.query('ROLLBACK')}
  ok(role+' cannot change global pause');
 }
 await pause(false);const job=(await req(actor)).rows[0].id;
 const lease=(await c.query('SELECT * FROM mvp_claim_deletion($1)',[job])).rows[0].lease_token;
 assert.equal((await c.query('SELECT * FROM mvp_claim_deletion($1)',[job])).rowCount,0);ok('F second live worker cannot claim');
 await c.query('SELECT mvp_prepare_deletion($1,$2)',[job,lease]);await pause(true);
 await assert.rejects(c.query("SELECT mvp_deletion_checkpoint($1,$2,'after_prepare')",[job,lease]),/DELETION_PAUSED/);
 await assert.rejects(c.query("SELECT mvp_advance_deletion($1,$2,'requested','prepared')",[job,lease]),/DELETION_PAUSED/);ok('B prepared work does not advance during pause');
 await assert.rejects(c.query('SELECT * FROM mvp_claim_deletion($1)',[job]),/DELETION_PAUSED/);ok('Paused retry cannot start');
 await assert.rejects(c.query("SELECT mvp_begin_deletion_effect($1,$2,'storage_delete',$3)",[job,lease,randomUUID()]),/DELETION_PAUSED/);ok('C no Storage permit during pause');
 await pause(false);await c.query("SELECT mvp_advance_deletion($1,$2,'requested','prepared');",[job,lease]);await c.query("SELECT mvp_advance_deletion($1,$2,'prepared','auth_unknown')",[job,lease]);
 await pause(true);await assert.rejects(c.query('DELETE FROM auth.users WHERE id=$1',[actor]),/DELETION_PAUSED/);
 assert.equal((await c.query('SELECT id FROM auth.users WHERE id=$1',[actor])).rowCount,1);ok('D Auth database trigger preserves user during pause');
 await pause(false);
 await assert.rejects(c.query("SELECT mvp_begin_deletion_effect($1,$2,'auth_delete',NULL)",[job,randomUUID()]),/LEASE_LOST/);ok('Forged lease cannot acquire effect');
 const effect=(await c.query("SELECT mvp_begin_deletion_effect($1,$2,'auth_delete',NULL) id",[job,lease])).rows[0].id;
 assert.equal((await snapshot()).active_effects,1);await pause(true);ok('In-flight external permit remains observable after pause');
 await c.query("SELECT mvp_release_deletion($1,$2)",[job,lease]);
 await pause(false);await assert.rejects(c.query('SELECT * FROM mvp_claim_deletion($1)',[job]),/DELETION_EFFECT_IN_FLIGHT/);ok('Expired or released lease cannot duplicate unfinished external effect');
 await pause(true);await assert.rejects(c.query("SELECT mvp_reconcile_deletion_effect($1,'unchecked')",[effect]),/RECONCILIATION_REQUIRES/);
 await c.query("SELECT mvp_reconcile_deletion_effect($1,'worker_stopped_external_checked')",[effect]);ok('Owner recovery requires paused verified context and records operator');
 await pause(false);const fresh=(await c.query('SELECT * FROM mvp_claim_deletion($1)',[job])).rows[0].lease_token;
 const done=(await c.query("SELECT mvp_begin_deletion_effect($1,$2,'auth_delete',NULL) id",[job,fresh])).rows[0].id;
 await c.query('DELETE FROM auth.users WHERE id=$1',[actor]);await pause(true);
 await c.query('SELECT mvp_end_deletion_effect($1,$2,$3,true)',[job,fresh,done]);ok('Dispatched effect result can be recorded while paused');
 await pause(false);await c.query("SELECT mvp_advance_deletion($1,$2,'auth_unknown','auth_deleted')",[job,fresh]);await c.query("SELECT mvp_advance_deletion($1,$2,'auth_deleted','completed')",[job,fresh]);
 assert.equal((await c.query('SELECT stage FROM account_deletion_jobs WHERE id=$1',[job])).rows[0].stage,'completed');ok('E pause resume completes');
 await pause(true);assert.equal((await snapshot()).active_effects,0);ok('Final pause has no active effects');
};
