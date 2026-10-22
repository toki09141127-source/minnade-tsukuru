/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js'),c=require('../staging/safety.cjs').load();
const dir=path.join(c.root,'.staging-private'),state=JSON.parse(fs.readFileSync(path.join(dir,'v2-e2e.json')));assert.equal(state.projectRef,c.ref);assert.ok(state.readyForPublish,'UI_CHECKS_REQUIRED');
const uuid=v=>{assert.match(v,/^[0-9a-f-]{36}$/);return v},a=uuid(state.primary),b=uuid(state.incomplete),run=uuid(state.runId),owner=uuid(state.users[0].id),other=uuid(state.users[9].id),key=BigInt('0x'+run.replaceAll('-','').slice(0,12)).toString();
if(process.argv[2]==='prepare'){
 const fixture=`BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';
LOCK TABLE public.rooms IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.rooms WHERE v2_enabled AND status='open' AND title='TEST V2 ${run.slice(0,8)}' AND ((id='${a}' AND created_by='${owner}') OR (id='${b}' AND created_by='${other}')))<>2 THEN RAISE EXCEPTION 'SYNTHETIC_FIXTURE_MISMATCH'; END IF;
END $$;
-- Exact synthetic fixtures only. The exclusive lock prevents all concurrent room writes.
-- All authorization, membership, withdrawal and Storage guards remain enabled.
ALTER TABLE public.rooms DISABLE TRIGGER v2_settings_immutable;
UPDATE public.rooms SET expires_at=clock_timestamp()-interval '1 second' WHERE id IN ('${a}','${b}');
ALTER TABLE public.rooms ENABLE TRIGGER v2_settings_immutable;
CREATE FUNCTION public.v2_staging_fixture_publish(p_run uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NOT NULL OR p_run IS DISTINCT FROM '${run}'::uuid THEN RAISE EXCEPTION 'FIXTURE_ONLY'; END IF;
 -- A separate SQL transaction locks every nonfixture room before taking this sentinel.
 IF pg_try_advisory_xact_lock(${key}::bigint) THEN RAISE EXCEPTION 'FIXTURE_GUARD_NOT_READY'; END IF;
 RETURN public.mvp_publish_due();
END $$;
REVOKE ALL ON FUNCTION public.v2_staging_fixture_publish(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v2_staging_fixture_publish(uuid) TO service_role;
COMMIT;
`;
 fs.writeFileSync(path.join(dir,'v2-fixture-prepare.sql'),fixture);
 fs.writeFileSync(path.join(dir,'v2-fixture-guard.sql'),`BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='65s'; DO $$ BEGIN PERFORM 1 FROM public.rooms WHERE id NOT IN ('${a}','${b}') FOR UPDATE; PERFORM pg_advisory_xact_lock(${key}::bigint); PERFORM pg_sleep(55); END $$; ROLLBACK;`);
 fs.writeFileSync(path.join(dir,'v2-fixture-cleanup.sql'),"BEGIN; DROP FUNCTION public.v2_staging_fixture_publish(uuid); SELECT count(*) AS enabled_immutable_trigger FROM pg_trigger WHERE tgname='v2_settings_immutable' AND tgenabled='O'; COMMIT;");
 console.log('Prepared exact two-fixture deadline and guarded publication SQL; not executed');
}else if(process.argv[2]==='publish'){
 Object.assign(process.env,c.env);require('../staging/web-network.cjs');
 (async()=>{const admin=createClient(c.url,c.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const publish=async()=>{for(let attempt=0;attempt<20;attempt++){const r=await admin.rpc('v2_staging_fixture_publish',{p_run:run});if(!r.error)return r.data;if(r.error.message!=='FIXTURE_GUARD_NOT_READY')throw Error('FIXTURE_PUBLISH_FAILED');await new Promise(r=>setTimeout(r,500))}throw Error('FIXTURE_LOCK_NOT_HELD')};
 const counts=await Promise.all([publish(),publish()]);assert.equal(counts.reduce((n,x)=>n+x,0),2,'EXACTLY_TWO_FIXTURES');
 const anon=createClient(c.url,c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});for(const id of [a,b]){const q=await anon.from('v2_work_snapshots').select('room_id').eq('room_id',id);assert.ok(!q.error&&q.data.length===1,'ONE_SNAPSHOT_PER_FIXTURE')}
 fs.writeFileSync(path.join(c.root,'docs/v2-staging-publication.json'),JSON.stringify({projectRef:c.ref,runId:run,concurrentWorkers:2,counts,snapshots:2,complete:true,productionChanges:'NONE'},null,2)+'\n');
 fs.writeFileSync(path.join(dir,'v2-published-'+run+'.signal'),'published');console.log('PASS guarded concurrent publication: exactly two synthetic snapshots');
 })().catch(()=>{console.error('TARGETED_PUBLICATION_FAILED; no success signal');process.exitCode=1});
}else throw Error('MODE_REQUIRED');