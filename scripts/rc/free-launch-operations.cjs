/* eslint-disable @typescript-eslint/no-require-imports */
const x=require('./free-release-context.cjs'),crypto=require('crypto');const {assert,fs}=x;
(async()=>{let db;const mode=process.argv[2],out={at:new Date().toISOString(),mode,projectRef:x.REF,complete:false};try{
assert.equal(process.argv[3],x.REF);assert.ok(['inspect','promote','window','resume'].includes(mode));
const d=x.read('v2-free-production-deployment.json');assert.equal(d.project,x.PROJECT);
const remote=JSON.parse(x.cli(['inspect',d.url,'--json']));assert.equal(remote.name,'minnade-tsukuru');assert.equal(remote.target,'production');assert.equal('https://'+remote.url,d.url);out.deploymentId=remote.id;out.state=remote.readyState||remote.status;
if(mode==='inspect'){d.state=out.state;d.deploymentId=remote.id;d.observedAt=out.at;x.save('v2-free-production-deployment.json',d);out.complete=true;return}
assert.equal(out.state,'READY');db=await x.connect();
if(mode==='promote'){
assert.ok((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='aaa_release_write_stop'")).rows[0].n>=39);
x.cli(['promote',d.url,'--yes']);out.canonicalAlias=x.BASE;out.generalWrites='STOPPED';
}else if(mode==='window'){
assert.equal(x.read('v2-production-restore-059-result.json').productionTestWindow.complete,true);assert.equal(x.read('v2-free-owner-result.json').complete,true);
assert.ok(!fs.existsSync(x.path.join(x.P.privateDir,'v2-free-fixture.aes')),'FIXTURE_ALREADY_EXISTS_REVIEW');
const runId=crypto.randomUUID(),users=['creator','member','other','operator'].map(label=>({label,id:crypto.randomUUID(),email:'v2free-'+label+'-'+runId+'@example.invalid',password:crypto.randomBytes(32).toString('base64url')}));
const expiresAt=new Date(Date.now()+2*3600000).toISOString();
x.privateSave('v2-free-fixture.aes',{runId,projectRef:x.REF,users,ids:{},expiresAt});
await db.query('BEGIN');await db.query("UPDATE mvp_private.ai_control SET enabled=false WHERE singleton");await db.query(require('./free-launch-test-window.cjs').sql(expiresAt,users));await db.query('COMMIT');
out.expiresAt=expiresAt;out.syntheticUsers=4;out.generalWrites='STOPPED except exact registered TEST rows';out.ai='OFF';
}else if(mode==='resume'){
for(const file of ['v2-free-smoke-result.json','v2-free-security-result.json','v2-free-deletion-result.json'])assert.equal(x.read(file).complete,true,'ALL_SMOKE_GATES_REQUIRED');
for(const file of ['v2-free-test-cleanup.json','v2-free-legacy-comparison.json','v2-free-production-email-settings.json','v2-free-project-flags.json'])assert.equal(x.read(file).complete,true,'CLEANUP_AND_RELEASE_PROOF_REQUIRED');
assert.equal((await db.query("SELECT count(*)::int n FROM admin_users WHERE active AND role='owner'")).rows[0].n,1);
assert.equal((await db.query("SELECT count(*)::int n FROM admin_users WHERE user_id=$1 AND active AND role='owner'",[x.OWNER])).rows[0].n,1);
const before=x.privateRead('v2-free-maintenance-before.aes');
assert.equal((await db.query("SELECT count(*)::int n FROM account_deletion_jobs WHERE stage<>'completed' OR lease_until>now()")).rows[0].n,0);assert.equal((await db.query("SELECT count(*)::int n FROM mvp_private.deletion_effects WHERE state<>'finished'")).rows[0].n,0);
assert.equal((await db.query("SELECT enabled FROM buffer_control")).rows[0].enabled,before.buffer);
assert.equal((await db.query("SELECT enabled FROM mvp_private.ai_control")).rows[0].enabled,false);
await db.query('BEGIN');
const guards=(await db.query("SELECT n.nspname s,c.relname t,g.tgname n FROM pg_trigger g JOIN pg_class c ON c.oid=g.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=g.tgfoid JOIN pg_namespace f ON f.oid=p.pronamespace WHERE f.nspname='mvp_release_stop'")).rows;
assert.ok(guards.length>=78);
const quote=s=>'"'+s.replaceAll('"','""')+'"';
for(const g of guards)await db.query('DROP TRIGGER '+quote(g.n)+' ON '+quote(g.s)+'.'+quote(g.t));
await db.query('DROP SCHEMA mvp_release_stop CASCADE');
await db.query('SELECT mvp_set_deletion_pause($1)',[before.deletionPaused]);
await db.query("UPDATE mvp_private.admin_control SET flags=jsonb_set(flags,'{deletion_intake}',to_jsonb($1::boolean)),version=version+1 WHERE singleton",[!before.deletionPaused]);
await db.query('UPDATE buffer_scheduler_config SET enabled=$1 WHERE singleton',[before.scheduler]);
for(const c of before.cron)await db.query('SELECT cron.alter_job($1::bigint,active:=$2::boolean)',[c.jobid,c.active]);
await db.query('COMMIT');out.generalWrites='OPEN';out.originalBufferStateRestored=true;out.deletionPaused=before.deletionPaused;out.activeCron=before.cron.filter(c=>c.active).length;out.ai='OFF';out.liveBilling='OFF';
}
out.complete=true;
}catch(e){out.failure=x.P.publicFailure(e);process.exitCode=1}finally{if(db){await db.query('ROLLBACK').catch(()=>{});await db.end()}x.save('v2-free-'+mode+'-result.json',out);console.log(JSON.stringify(out))}})();
