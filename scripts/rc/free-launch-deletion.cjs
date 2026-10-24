/* eslint-disable @typescript-eslint/no-require-imports */
const x=require('./free-release-context.cjs');
(async()=>{let h;try{
for(const file of ['v2-free-smoke-result.json','v2-free-security-result.json'])x.assert.equal(x.read(file).complete,true);
h=await require('./free-launch-smoke-context.cjs')('deletion');const {db,f,admin,clients,call,expect,assert,step}=h,u=f.users[1];
const a=await admin.auth.admin.getUserById(u.id);assert.equal(a.data.user.user_metadata.release_test,f.runId);
const otherBefore=(await db.query('SELECT id,stage,updated_at FROM account_deletion_jobs WHERE actor_id IS DISTINCT FROM $1 ORDER BY id',[u.id])).rows;
await h.feature('deletion_worker',true);await h.feature('deletion_intake',true);
await step('FREE_BILLING_STOP_BEFORE_PREPARATION_AND_AUTH_LAST',async()=>{
 const r=await call(1,'/api/account/delete',{confirm:true,attribution:'anonymous',policyVersion:'withdrawal-draft-2026-10-21'});assert.ok([200,202].includes(r.status)&&r.data.requestId,'DELETION_ACCEPTED');f.deletionJob=r.data.requestId;h.save();
 let data=r.data;
 for(let i=0;data.state!=='completed'&&i<3;i++){
 assert.ok(['retry','busy','requested'].includes(data.state),'UNEXPECTED_DELETION_STATE');
 await new Promise(resolve=>setTimeout(resolve,1500));
 const q=await fetch(h.BASE+'/api/cron/account-deletion',{method:'POST',headers:{authorization:'Bearer '+h.env().CRON_SECRET,'content-type':'application/json'},body:JSON.stringify({requestId:f.deletionJob}),signal:AbortSignal.timeout(60000)});data=await q.json();assert.ok([200,202].includes(q.status),'WORKER_HTTP');
 }
 assert.equal(data.state,'completed','DELETION_NOT_COMPLETED');
 const job=(await db.query("SELECT stage,(SELECT count(*)::int FROM mvp_private.deletion_effects WHERE job_id=$1 AND state<>'finished') unfinished FROM account_deletion_jobs WHERE id=$1",[f.deletionJob])).rows[0];assert.equal(job.stage,'completed');assert.equal(job.unfinished,0);
 const billing=(await db.query('SELECT owner_id,status,deleting,deletion_confirmed FROM billing_accounts WHERE id=$1',[f.memberBillingId])).rows[0];assert.ok(billing&&billing.owner_id===null&&billing.deleting&&billing.deletion_confirmed&&billing.status==='canceled');
});
await step('AUTH_REMOVED_OLD_LOGIN_AND_WRITE_REJECTED',async()=>{
 const gone=await admin.auth.admin.getUserById(u.id);assert.equal(gone.error?.status,404);assert.equal(gone.error?.code,'user_not_found');
 assert.ok((await clients[1].auth.signInWithPassword({email:u.email,password:u.password})).error);
 expect(await call(1,'/api/posts/create',{roomId:f.room,content:'TEST stale token'}),401);
});
await step('PUBLISHED_CONTRIBUTION_AND_USED_BYTES_RETAINED_UNUSED_REMOVED',async()=>{
 const p=(await db.query('SELECT user_id,username,deleted_at FROM posts WHERE id=$1',[f.imagePost])).rows[0];assert.ok(p&&p.user_id!==u.id&&p.username==='退会したメンバー'&&p.deleted_at===null);
 const w=await call(null,'/api/v2/work?roomId='+f.room);expect(w);assert.ok(w.data.blocks.some(b=>b.text==='TEST FREE V2 shared published work'));
 const used=await admin.storage.from('room_uploads').download(f.used.storagePath);assert.ok(!used.error);assert.equal(h.crypto.createHash('sha256').update(Buffer.from(await used.data.arrayBuffer())).digest('hex'),f.usedHash);
 assert.equal((await db.query("SELECT count(*)::int n FROM storage.objects WHERE bucket_id='room_uploads' AND name=$1",[f.unused.storagePath])).rows[0].n,0);
 const absent=await admin.storage.from('room_uploads').download(f.unused.storagePath);assert.ok(absent.error);
 const effects=(await db.query("SELECT effect,count(*)::int n,bool_and(state='finished') finished FROM mvp_private.deletion_effects WHERE job_id=$1 GROUP BY effect",[f.deletionJob])).rows;assert.equal(effects.length,2);assert.ok(effects.every(v=>v.n===1&&v.finished));
});
await step('UNRELATED_DELETION_JOBS_UNCHANGED',async()=>assert.deepEqual((await db.query('SELECT id,stage,updated_at FROM account_deletion_jobs WHERE id<>$1 ORDER BY id',[f.deletionJob])).rows,otherBefore));
h.out.complete=true;h.out.finishedAt=new Date().toISOString();h.save();
}catch(e){if(h){h.out.failure=h.P.publicFailure(e);h.save()}console.log(JSON.stringify({complete:false,...x.P.publicFailure(e)}));process.exitCode=1}
finally{if(h){await h.feature('deletion_intake',false).catch(()=>{});await h.db.query('SELECT mvp_set_deletion_pause(true)').catch(()=>{});await h.close()}}})();
