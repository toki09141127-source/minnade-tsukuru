/* eslint-disable @typescript-eslint/no-require-imports */
// Only the private localhost clone is mutable. Never log rows, definitions or SQL errors.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const q=s=>'"'+s.replaceAll('"','""')+'"';
module.exports=async({db,report,meta})=>{
 assert.equal(db.connectionParameters.host,'127.0.0.1');
 assert.match(db.connectionParameters.user,/^restore_admin_[a-f0-9]{16}$/);
 const entries=require('./migrations.cjs').inventory();
 const applied=[...JSON.parse(fs.readFileSync('docs/release52-production-migrations.json')).migrations,...JSON.parse(fs.readFileSync('docs/buffer-production-migrations.json')).entries];
 assert.equal(applied.length,38);
 for(const a of applied){const e=entries.find(e=>e.number===a.number);assert.equal(a.state,'applied');assert.equal(e.file,a.file);assert.equal(e.sha256,a.sha256);assert.equal(e.productionApplied,true)}
 report.productionAppliedHash={pass:true,count:38,combinedSha256:crypto.createHash('sha256').update(applied.map(x=>x.file+':'+x.sha256).join('\n')).digest('hex')};
 const withConsent=process.argv.includes('--with-consent');
 const selected=entries.filter(e=>e.number>=42&&e.number<=(withConsent?59:58));assert.equal(selected.length,withConsent?18:17);
 report.skippedHistoricalMigrations=[36,40,41];
 const freeGuard=process.argv.includes('--with-free-release-guard');
 if(freeGuard){const localStop=fs.readFileSync('docs/release52-staging-stop.sql','utf8').replace("'postgres','supabase_admin'","'postgres','supabase_admin','"+db.connectionParameters.user+"'");await db.query(localStop);report.maintenanceHookRehearsal=true;report.localMaintenancePrincipal='Isolated restore administrator added to local allowlist only; production SQL unchanged';}
 const columns=(await db.query("SELECT table_schema s,table_name t,column_name c FROM information_schema.columns WHERE table_schema=ANY($1) ORDER BY 1,2,ordinal_position",[['public','mvp_private','auth','storage']])).rows;
 const tables=meta.counts.filter(t=>['public','mvp_private','auth','storage'].includes(t.schema));
 const fingerprints=async()=>{const out=[];for(const t of tables){const names=columns.filter(x=>x.s===t.schema&&x.t===t.name).map(x=>x.c);const projection=names.map(q).join(',');const row=(await db.query('SELECT count(*)::text n,md5(coalesce(string_agg(h,\'\' ORDER BY h),\'\')) h FROM (SELECT md5(row_to_json(x)::text) h FROM (SELECT '+projection+' FROM '+q(t.schema)+'.'+q(t.name)+') x) y')).rows[0];out.push({schema:t.schema,table:t.name,...row})}return out};
 const original=await fingerprints();
 const signatures=async()=> (await db.query("SELECT n.nspname s,p.proname n,pg_get_function_identity_arguments(p.oid) a,pg_get_function_result(p.oid) r FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'mvp_%' OR p.proname LIKE 'buffer_%') ORDER BY 1,2,3")).rows;
 const originalSignatures=await signatures();
 report.migrationRehearsal=[];
 for(const e of selected){
  report.currentPhase='migration '+e.number;
  const sql=fs.readFileSync('supabase/migrations/'+e.file,'utf8');assert.match(sql,/BEGIN;/);assert.match(sql,/COMMIT;/);
  await db.query(freeGuard?sql.replace(/COMMIT;\s*$/,()=>require('./free-release-context.cjs').guardNewTables+'\nCOMMIT;'):sql);
  if(freeGuard){const gaps=(await db.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT EXISTS(SELECT 1 FROM pg_trigger g WHERE g.tgrelid=c.oid AND g.tgname='aaa_release_write_stop')")).rows[0].n;assert.equal(gaps,0,'MAINTENANCE_GAP_'+e.number);}
  assert.deepEqual(await fingerprints(),original,'LEGACY_DATA_CHANGED_'+e.number);
  const now=await signatures();for(const f of originalSignatures)assert.ok(now.some(x=>JSON.stringify(x)===JSON.stringify(f)),'LEGACY_SIGNATURE_CHANGED_'+e.number);
  const newTables=(await db.query("SELECT c.relname name,c.relrowsecurity rls,has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') anon,has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') auth_write FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relname=ANY($1)",[tables.filter(t=>t.schema==='public').map(t=>t.name)])).rows;
  assert.ok(newTables.every(x=>x.rls&&!x.anon&&!x.auth_write),'NEW_TABLE_BOUNDARY_'+e.number);
  report.migrationRehearsal.push({number:e.number,file:e.file,sha256:e.sha256,pass:true,legacyRowsAndOriginalColumnHashesUnchanged:true,legacyRpcSignaturesUnchanged:true,newTableRlsAndWriteBoundary:true,newTables:newTables.length});
 }
 report.currentPhase='final rehearsal checks';
 const roles=(await db.query("SELECT rolname FROM pg_roles WHERE rolcanlogin AND rolname<>current_user")).rows;assert.equal(roles.length,0);
 const checks=[['V2 tables present',"SELECT to_regclass('public.v2_work_snapshots') IS NOT NULL AND to_regclass('public.room_ai_tasks') IS NOT NULL ok"],['Admin remains unassigned',"SELECT count(*)=0 ok FROM public.admin_users"],['Old rooms keep legacy mode',"SELECT count(*)=0 ok FROM public.rooms WHERE v2_enabled"],['Auth deletion guards retained',"SELECT count(*)>0 ok FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal"]];
 for(const [name,sql] of checks){const row=(await db.query(sql)).rows[0];assert.equal(row.ok,true,name);report.checks.push({name,pass:true})}
 report.rehearsalComplete=true;
 if(withConsent){const consent=(await db.query("SELECT pg_get_functiondef('mvp_accept_current_terms(text,text,boolean)'::regprocedure) d")).rows[0].d;assert.ok(consent.includes('2026-10-24')&&!consent.includes('2026-10-22'));report.checks.push({name:'059 changes required consent without backfilling original profiles',pass:true})}
 if(freeGuard)await require('./free-release-auth-rehearsal.cjs')(db,report);
 if(freeGuard)await require('./free-launch-window-rehearsal.cjs')(db,report);
 report.rehearsalScope='Actual encrypted production snapshot data; '+selected.length+' missing application migrations; per-migration data fingerprints, legacy RPC signature compatibility, new RLS/direct-grant boundaries. No HTTP app flows or hosted service recovery. Managed network contracts inert.';
};
