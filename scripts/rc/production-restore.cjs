/* eslint-disable @typescript-eslint/no-require-imports */
// Local isolated restore proof. No production network connection and no user-row output.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net'),cp=require('node:child_process');
const P=require('./production-private.cjs');
const schemas=['public','mvp_private','auth','storage','supabase_migrations','mvp_release_stop'];
const quote=s=>'"'+s.replace(/"/g,'""')+'"';
function canonical(x){if(Array.isArray(x))return x.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return x}
function same(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b))}
async function main(){
 const key=P.encryptionKey(),backup=fs.readFileSync(path.join(P.privateDir,'v2-readiness-backup-directory.txt'),'utf8').trim();
 const base=fs.realpathSync(P.privateDir),resolved=fs.realpathSync(backup);if(!resolved.startsWith(base+path.sep)||!path.basename(resolved).startsWith('v2-readiness-backup-'))throw Error('BACKUP_PATH_REJECTED');
 const read=name=>P.decrypt(fs.readFileSync(path.join(resolved,name+'.aes')),key),manifest=JSON.parse(read('manifest.json'));
 if(manifest.projectRef!=='joedeuyrzimqyjapqpyh'||!manifest.complete)throw Error('COMPLETE_PRODUCTION_BACKUP_REQUIRED');
 const meta=JSON.parse(read('metadata.json')),archive=read('database.dump');
 if(crypto.createHash('sha256').update(archive).digest('hex')!==manifest.database.sha256)throw Error('ARCHIVE_HASH_MISMATCH');
 const ctx=require('../staging/safety.cjs').load(),{Client}=require(path.join(ctx.env.MVP_TEST_RUNTIME,'node_modules/pg'));
 const bin=path.join(P.privateDir,'tools/pgsql/bin'),dir=fs.mkdtempSync(path.join(base,'restore-')),data=path.join(dir,'data'),user='restore_admin_'+crypto.randomBytes(8).toString('hex'),pass=crypto.randomBytes(32).toString('base64url');
 const sock=net.createServer();await new Promise(r=>sock.listen(0,'127.0.0.1',r));const port=sock.address().port;await new Promise(r=>sock.close(r));
 const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG'))),PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:user,PGPASSWORD:pass,PGDATABASE:'postgres',PGSSLMODE:'disable',PGOPTIONS:'',PGCONNECT_TIMEOUT:'10'};
 const r={scope:'Private local PostgreSQL restore of actual production public/auth/storage/migration schemas; no hosted Auth/Storage API emulation',projectRef:manifest.projectRef,checks:[],complete:false,limitations:['Vault root encryption keys, external OAuth/SMTP credentials, Supabase service configuration and hosted service versions require separate operator recovery','DPAPI backup key requires this Windows account/profile; off-device recovery not yet demonstrated']};
 let c,started=false;
 const run=(exe,args,input)=>{console.log('LOCAL_RESTORE_STEP '+exe);const out=cp.spawnSync(path.join(bin,exe+'.exe'),args,{env,input,encoding:null,stdio:exe==='pg_ctl'?['ignore','ignore','ignore']:['pipe','pipe','pipe'],windowsHide:true,timeout:180000,maxBuffer:1024*1024*1024});if(out.error||out.status!==0){P.writeEncrypted(path.join(resolved,'restore-'+exe+'.stderr.aes'),out.stderr||Buffer.alloc(0),key);throw Error('RESTORE_'+exe.toUpperCase().replaceAll('-','_')+'_FAILED')}return out.stdout};
 const ok=(v,name)=>{if(!v)throw Error(name);r.checks.push({name,pass:true})};
 try{
  const archiveFile=path.join(dir,'archive.dump');fs.writeFileSync(archiveFile,archive);const pw=path.join(dir,'init-password.tmp');fs.writeFileSync(pw,pass);
  run('initdb',['-D',data,'-U',user,'--auth=scram-sha-256','--pwfile='+pw,'--locale=C','--encoding=UTF8']);fs.unlinkSync(pw);
  fs.appendFileSync(path.join(data,'postgresql.conf'),"\nlisten_addresses='127.0.0.1'\nport="+port+"\nlogging_collector=off\nlog_statement='none'\nlog_min_error_statement=panic\n");
  run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-w','start']);started=true;
  c=new Client({host:'127.0.0.1',port,user,password:pass,database:'postgres',connectionTimeoutMillis:10000,statement_timeout:30000,query_timeout:35000});await c.connect();
  const roleSql=read('roles.sql').toString('utf8').split(/\r?\n/).map(line=>line.startsWith('GRANT ')?line.replace(/ GRANTED BY [a-z_][a-z0-9_]*;$/,';'):line).join('\n'); run('psql',['-X','--set=ON_ERROR_STOP=1','--single-transaction','--file=-'],roleSql);r.limitations.push('Role membership grantor is the isolated restore administrator; membership options are retained and restored roles cannot log in');
  const restoredRoles=(await c.query("SELECT rolname FROM pg_roles WHERE rolname !~ '^pg_' AND rolname<>$1",[user])).rows;
  for(const x of restoredRoles)await c.query('ALTER ROLE '+quote(x.rolname)+' NOLOGIN');
  // Keep initdb's public schema unless the archive explicitly recreates it.
  const namespaceSet=new Set([...schemas,...(meta.catalog.extensions||[]).map(e=>e.schema)]);
  const toc=run('pg_restore',['--list',archiveFile]).toString('utf8').split(/\r?\n/);
  const entry=line=>line.match(/^\d+; \d+ \d+ ([A-Z][A-Z ]*?) ([-a-z_]+) (.*)$/);
  const namespaceName=tail=>tail.split(' ')[0];
  const schemaLines=toc.filter(line=>{const x=entry(line);return x&&x[1]==='SCHEMA'&&namespaceSet.has(namespaceName(x[3]))});
  if(schemaLines.some(x=>x.includes('SCHEMA - public ')))await c.query('DROP SCHEMA public CASCADE'); if(!schemaLines.some(x=>x.includes('SCHEMA - auth ')))throw Error('AUTH_SCHEMA_TOC_REQUIRED');
  const schemaList=path.join(dir,'schemas.list');fs.writeFileSync(schemaList,schemaLines.join('\n')+'\n');
  run('pg_restore',['--exit-on-error','--single-transaction','--dbname=postgres','--use-list='+schemaList,archiveFile]);
  const available=new Set((await c.query('SELECT name FROM pg_available_extensions')).rows.map(x=>x.name));
  const extensions=meta.catalog.extensions||[];r.unavailableManagedExtensions=[];
  for(const e of extensions){if(e.name==='plpgsql')continue;if(!available.has(e.name)){r.unavailableManagedExtensions.push(e.name);continue}await c.query('CREATE SCHEMA IF NOT EXISTS '+quote(e.schema));await c.query('CREATE EXTENSION IF NOT EXISTS '+quote(e.name)+' WITH SCHEMA '+quote(e.schema));}
  // Managed network workers are never loaded. Supply only inert local contracts when unavailable.
  if(r.unavailableManagedExtensions.some(x=>['http','pg_net','pg_cron','supabase_vault'].includes(x))){
   let contracts=fs.readFileSync('scripts/rc/platform-contracts.sql','utf8').replaceAll('CREATE SCHEMA ','CREATE SCHEMA IF NOT EXISTS ');
   await c.query(contracts);r.platformContracts=['http','pg_net','pg_cron','vault'];
   r.limitations.push('Unavailable managed extensions use inert local type/contracts; no scheduler, network, Vault root key or hosted Auth/Storage service recovery is certified');
  }
  const objectLines=toc.filter(line=>{const x=entry(line);if(!x||x[1]==='SCHEMA')return false;if(schemas.includes(x[2]))return true;return ['ACL','COMMENT'].includes(x[1])&&x[2]==='-'&&x[3].startsWith('SCHEMA ')&&namespaceSet.has(x[3].split(' ')[1])});
  const objectList=path.join(dir,'objects.list');fs.writeFileSync(objectList,objectLines.join('\n')+'\n');
  r.currentPhase='archive application schemas';run('pg_restore',['--exit-on-error','--single-transaction','--dbname=postgres','--use-list='+objectList,archiveFile]);r.currentPhase='restore verification';
  for(const t of meta.counts){const x=(await c.query('SELECT count(*)::text AS count FROM '+quote(t.schema)+'.'+quote(t.name))).rows[0];ok(x.count===t.count,'TABLE_COUNT_'+t.schema+'_'+t.name)}
  const policies=(await c.query('SELECT jsonb_agg(p) AS items FROM pg_policies p WHERE schemaname=ANY($1)',[schemas])).rows[0].items||[];
  ok(same(policies,(meta.catalog.policies||[]).filter(x=>schemas.includes(x.schemaname))),'POLICIES_MATCH');
  const acl=(await c.query("SELECT n.nspname AS schema,c.relname AS name,c.relacl AS acl,c.relrowsecurity AS rls,c.relforcerowsecurity AS force FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND c.relkind IN ('r','v','p')",[schemas])).rows;
  // pg parses aclitem[] as its text form; compare via JSONB on both sides.
  const normalizedAcl=(await c.query("SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity)) AS items FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND c.relkind IN ('r','v','p')",[schemas])).rows[0].items||[];
  void acl;
  const normalizeAcl=async rows=>{const result=[];for(const item of rows){const owner=(await c.query('SELECT relowner FROM pg_class WHERE oid=$1::regclass',[quote(item.schema)+'.'+quote(item.name)])).rows[0].relowner;const rights=(await c.query("SELECT grantor::regrole::text grantor,grantee::regrole::text grantee,privilege_type,is_grantable FROM aclexplode(coalesce($1::aclitem[],acldefault('r',$2::oid))) ORDER BY 1,2,3,4",[item.acl,owner])).rows;result.push({...item,acl:rights})}return result};
  ok(same(await normalizeAcl(normalizedAcl),await normalizeAcl(meta.catalog.table_acl||[])),'TABLE_EFFECTIVE_ACL_AND_RLS_MATCH');
  r.aclNormalization='pg_restore preserves archive owners; null ACL expanded with acldefault and compared via aclexplode including grantor/grantee/options; raw explicit owner-default and null are equivalent';
  const constraints=(await c.query("SELECT n.nspname AS schema,c.relname AS table,x.conname AS name,pg_get_constraintdef(x.oid) AS definition FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND x.contype<>'n'",[schemas])).rows;
  r.constraintNormalization='PostgreSQL 18 table NOT NULL catalog entries omitted from comparison with PostgreSQL 17 pg_constraint; archived NOT NULL DDL remains applied';
  ok(same(constraints,meta.catalog.constraints||[]),'CONSTRAINTS_MATCH');
  const structureRows=(await c.query("SELECT 'function' kind,n.nspname||'.'||p.proname||pg_get_function_identity_arguments(p.oid) name,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND n.nspname IN ('public','mvp_private','auth','storage') UNION ALL SELECT 'trigger',n.nspname||'.'||t.relname||'.'||g.tgname,pg_get_triggerdef(g.oid) FROM pg_trigger g JOIN pg_class t ON t.oid=g.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE NOT g.tgisinternal AND n.nspname IN ('public','mvp_private','auth','storage') UNION ALL SELECT 'index',schemaname||'.'||indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','mvp_private','auth','storage') ORDER BY 1,2")).rows;
  ok(same(structureRows,meta.catalog.structures),'FUNCTION_TRIGGER_INDEX_DEFINITIONS_MATCH');r.structureCount=structureRows.length;
  const objects=JSON.parse(read('storage-manifest.json'));for(const o of objects){if(!/^object-\d{6}\.aes$/.test(o.file))throw Error('OBJECT_PATH_REJECTED');const bytes=P.decrypt(fs.readFileSync(path.join(resolved,o.file)),key);ok(bytes.length===o.bytes&&crypto.createHash('sha256').update(bytes).digest('hex')===o.sha256,'STORAGE_OBJECT_HASH_'+r.checks.filter(x=>x.name.startsWith('STORAGE_OBJECT_HASH_')).length)}
  r.tableCount=meta.counts.length;r.storageObjectCount=objects.length;r.backupSha256=manifest.database.sha256;
  // Remove only the temporary maintenance guard in the isolated copy, after restore comparisons.
  if((await c.query("SELECT to_regprocedure('mvp_release_stop.reject_app_write()') IS NOT NULL AS present")).rows[0].present){
   const guards=(await c.query("SELECT n.nspname AS schema,t.relname AS table,g.tgname AS name FROM pg_trigger g JOIN pg_class t ON t.oid=g.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE g.tgfoid='mvp_release_stop.reject_app_write()'::regprocedure")).rows;
   for(const g of guards)await c.query('DROP TRIGGER '+quote(g.name)+' ON '+quote(g.schema)+'.'+quote(g.table));
   await c.query('DROP FUNCTION mvp_release_stop.reject_app_write(); DROP SCHEMA mvp_release_stop');r.localMaintenanceGuardRemoved=guards.length;
  }
  r.restoreComplete=true;
  await require('./production-rehearsal.cjs')({db:c,report:r,meta});
  r.complete=true;
 }catch(e){r.failure=P.publicFailure(e);r.failedAt=r.currentPhase||'restore';process.exitCode=1}
 finally{
  if(c)await c.end();if(started){run('pg_ctl',['-D',data,'-m','fast','-w','stop']);r.serverStopped=true}
  // This directory was created by this invocation. Verify its canonical parent before removing plaintext restore material.
  const target=fs.realpathSync(dir);if(path.dirname(target)!==base||!path.basename(target).startsWith('restore-'))throw Error('RESTORE_CLEANUP_PATH_REJECTED');fs.rmSync(target,{recursive:true,force:false});r.plaintextRestoreRemoved=true;
  fs.writeFileSync(process.argv.includes('--with-consent')?'docs/v2-production-restore-059-result.json':'docs/v2-production-restore-result.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({complete:r.complete,restoreComplete:r.restoreComplete,rehearsalComplete:r.rehearsalComplete,checks:r.checks.length,failure:r.failure,failedAt:r.failedAt,aclDifferences:r.aclDifferences,serverStopped:r.serverStopped,plaintextRestoreRemoved:r.plaintextRestoreRemoved}));
 }
}
main().catch(e=>{console.error(JSON.stringify(P.publicFailure(e)));process.exitCode=1});
