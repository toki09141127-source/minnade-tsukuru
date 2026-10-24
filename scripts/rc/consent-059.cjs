/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
const file='202610240059_v2_release_consent.sql',report={complete:false,checks:[],productionChanges:'NONE'};const ok=n=>report.checks.push({name:n,pass:true});
async function local(){const db=new PGlite();try{
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA mvp_private; CREATE TABLE profiles(id uuid PRIMARY KEY,deleted_at timestamptz,terms_version text,privacy_version text,terms_agreed_at timestamptz,privacy_agreed_at timestamptz,adult_confirmed_at timestamptz); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; CREATE FUNCTION mvp_current_account_active() RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND deleted_at IS NULL) $$;");
 const id='11111111-1111-4111-8111-111111111111';await db.query("INSERT INTO profiles(id,terms_version,privacy_version,terms_agreed_at,privacy_agreed_at,adult_confirmed_at) VALUES($1,'2026-10-22','2026-10-22',now(),now(),now())",[id]);
 await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 await assert.rejects(db.query('SELECT mvp_private.require_current_consent($1)',[id]));ok('Old consent cannot authorize protected writes');
 assert.equal((await db.query('SELECT terms_version FROM profiles')).rows[0].terms_version,'2026-10-22');ok('Migration does not backfill consent');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
 for(const args of [['2026-10-22','2026-10-22',true],['2026-10-24','2026-10-24',false],['2026-10-24','2026-10-24',null]]){await assert.rejects(db.query('SELECT mvp_accept_current_terms($1,$2,$3)',args));ok('Wrong version or missing adult attestation rejected')}
 await db.query("SELECT mvp_accept_current_terms('2026-10-24','2026-10-24',true)");await db.query('SELECT mvp_private.require_current_consent($1)',[id]);ok('Explicit new consent unlocks current contract');
 const a=(await db.query("SELECT has_function_privilege('anon','mvp_accept_current_terms(text,text,boolean)','EXECUTE') a,has_function_privilege('authenticated','mvp_accept_current_terms(text,text,boolean)','EXECUTE') u,has_function_privilege('service_role','mvp_accept_current_terms(text,text,boolean)','EXECUTE') s")).rows[0];assert.deepEqual(a,{a:false,u:true,s:false});ok('Only authenticated callers attest; service cannot impersonate consent');
 await db.query('UPDATE profiles SET deleted_at=now() WHERE id=$1',[id]);await assert.rejects(db.query("SELECT mvp_accept_current_terms('2026-10-24','2026-10-24',true)"));ok('Departing/inactive account cannot re-enable writes with consent');
 }finally{await db.close()}}
(async()=>{let db;try{await local();if(process.argv.includes('apply-staging')){
 process.env.LOCALAPPDATA='C:/Users/Sonet/AppData/Local';const x=await require('../billing/db.cjs')();db=x.db;assert.equal(x.ctx.ref,'fwqucffxdmbdczspkcyr');
 const m=require('./migrations.cjs').inventory().find(x=>x.number===59);assert.equal(m.file,file);
 const path='docs/v2-rc-consent-migration.json';assert.ok(!fs.existsSync(path),'ALREADY_ATTEMPTED_REVIEW_STATE');
 const spec={projectRef:x.ctx.ref,file,sha256:m.sha256,state:'started',productionChanges:'NONE'};
 const defs=(await db.query("SELECT pg_get_functiondef('mvp_accept_current_terms(text,text,boolean)'::regprocedure) d")).rows[0].d;assert.ok(defs.includes('2026-10-22')&&!defs.includes('2026-10-24'),'UNEXPECTED_CURRENT_CONSENT');
 const fingerprint=async()=> (await db.query("SELECT count(*)::int n,md5(coalesce(string_agg(md5(concat_ws('|',id,terms_version,privacy_version,terms_agreed_at,privacy_agreed_at,adult_confirmed_at)),'' ORDER BY id),'')) h FROM profiles")).rows[0];
 const before=await fingerprint();fs.writeFileSync(path,JSON.stringify(spec,null,2)+'\n');await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'");
 const sql=fs.readFileSync('supabase/migrations/'+file,'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');await db.query(sql);assert.deepEqual(await fingerprint(),before);await db.query('COMMIT');
 spec.state='applied';spec.appliedAt=new Date().toISOString();spec.noConsentBackfill=true;fs.writeFileSync(path,JSON.stringify(spec,null,2)+'\n');ok('Staging 059 applied with existing consent rows unchanged');
 }report.complete=true;
 }catch(e){report.failure={code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'CHECK_FAILED',name:/^[A-Z_]+$/.test(e.message||'')?e.message:'ASSERTION'};process.exitCode=1}
 finally{if(db){await db.query('ROLLBACK').catch(()=>{});await db.end()}fs.writeFileSync('docs/v2-rc-consent-059-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))}})();
