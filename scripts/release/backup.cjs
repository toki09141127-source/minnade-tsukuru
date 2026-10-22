/* eslint-disable @typescript-eslint/no-require-imports */
/** Production read-only snapshot backup; all raw output encrypted outside the repository. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),tls=require('node:tls');
const P=require('./private.cjs');const REF='joedeuyrzimqyjapqpyh';
async function main(){
 const stage=require('../staging/safety.cjs').load();const {Client}=require(path.join(stage.env.MVP_TEST_RUNTIME,'node_modules/pg'));
 const prod=require('dotenv').parse(fs.readFileSync('.env.local'));
 if(new URL(prod.NEXT_PUBLIC_SUPABASE_URL).hostname!==REF+'.supabase.co')throw Error('PRODUCTION_IDENTITY_MISMATCH');
 if(prod.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ')){const claims=JSON.parse(Buffer.from(prod.SUPABASE_SERVICE_ROLE_KEY.split('.')[1],'base64url'));if(claims.ref!==REF||claims.role!=='service_role')throw Error('PRODUCTION_KEY_MISMATCH')}else if(!prod.SUPABASE_SERVICE_ROLE_KEY?.startsWith('sb_secret_')||prod.SUPABASE_SERVICE_ROLE_KEY.length<25)throw Error('PRODUCTION_KEY_FORMAT_REJECTED');
 const bin=path.join(P.privateDir,'tools/pgsql/bin');for(const f of ['pg_dump.exe','pg_dumpall.exe'])if(!fs.existsSync(path.join(bin,f)))throw Error('POSTGRES_CLIENT_REQUIRED');
 const key=P.encryptionKey(),pass=P.password(),host='aws-1-ap-south-1.pooler.supabase.com',user='postgres.'+REF;
 const authority=fs.readFileSync(path.join(P.privateDir,'supabase-prod-ca.crt'),'utf8');if(!new crypto.X509Certificate(authority).ca)throw Error('DATABASE_CA_INVALID');const caText=tls.rootCertificates.join('\n')+'\n'+authority;const ca=path.join(P.privateDir,'public-root-ca.pem');fs.writeFileSync(ca,caText);
 const env={...process.env,PGHOST:host,PGPORT:'5432',PGUSER:user,PGDATABASE:'postgres',PGPASSWORD:pass,PGSSLMODE:'verify-full',PGSSLROOTCERT:ca,PGCONNECT_TIMEOUT:'15',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=180000',PGAPPNAME:'minnade_authorized_backup'};
 const c=new Client({host,port:5432,user,password:pass,database:'postgres',ssl:{rejectUnauthorized:true,ca:caText},connectionTimeoutMillis:15000,application_name:'minnade_backup_snapshot'});
 const stamp=new Date().toISOString().replace(/[:.]/g,'-'),dir=path.join(P.privateDir,'backup-'+stamp);fs.mkdirSync(dir);const result={scope:'PRODUCTION READ ONLY; encrypted backup outside repository',projectRef:REF,startedAt:new Date().toISOString(),complete:false};
 try{
  await c.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const info=(await c.query("SELECT current_database() db,current_user role,current_setting('transaction_read_only') read_only,current_setting('server_version') version,pg_export_snapshot() snapshot")).rows[0];if(info.db!=='postgres'||info.role!=='postgres'||info.read_only!=='on')throw Error('READ_ONLY_IDENTITY_FAILED');
  const dump=(exe,args,name)=>{const r=cp.spawnSync(path.join(bin,exe),args,{env,encoding:null,windowsHide:true,maxBuffer:1024*1024*1024,timeout:240000});if(r.stderr?.length)P.writeEncrypted(path.join(dir,name+'.stderr.aes'),r.stderr,key);if(r.status!==0)throw Error('DUMP_FAILED_'+name.toUpperCase().replace(/[^A-Z0-9]/g,'_'));P.writeEncrypted(path.join(dir,name+'.aes'),r.stdout,key);return {bytes:r.stdout.length,sha256:crypto.createHash('sha256').update(r.stdout).digest('hex')};};
  result.database=dump('pg_dump.exe',['--format=custom','--no-password','--snapshot='+info.snapshot],'database.dump');
  result.roles=dump('pg_dumpall.exe',['--roles-only','--no-role-passwords','--no-password'],'roles.sql');
  const tables=(await c.query("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','auth','storage','supabase_migrations') ORDER BY 1,2")).rows;
  const counts=[];for(const t of tables){const q=s=>'"'+s.replace(/"/g,'""')+'"';const row=(await c.query('SELECT count(*)::text AS count FROM '+q(t.schema)+'.'+q(t.name))).rows[0];counts.push({...t,count:row.count});}
  const catalog=(await c.query("SELECT jsonb_build_object('extensions',(SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion,'schema',n.nspname)) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),'policies',(SELECT jsonb_agg(p) FROM pg_policies p),'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypassrls',rolbypassrls,'inherit',rolinherit)) FROM pg_roles),'table_acl',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage','supabase_migrations') AND c.relkind IN ('r','v','p')),'constraints',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',x.conname,'definition',pg_get_constraintdef(x.oid))) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage','supabase_migrations'))) AS metadata")).rows[0].metadata;
  const objects=(await c.query('SELECT bucket_id,name,metadata,updated_at FROM storage.objects ORDER BY bucket_id,name')).rows;
  P.writeEncrypted(path.join(dir,'metadata.json.aes'),JSON.stringify({info:{...info,snapshot:undefined},counts,catalog,objects}),key);
  P.writeEncrypted(path.join(dir,'app-environment.aes'),fs.readFileSync('.env.local'),key);
  const {createClient}=require('@supabase/supabase-js');const admin=createClient(prod.NEXT_PUBLIC_SUPABASE_URL,prod.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const objectManifest=[];
  for(let i=0;i<objects.length;i++){const o=objects[i],{data,error}=await admin.storage.from(o.bucket_id).download(o.name);if(error||!data)throw Error('STORAGE_BACKUP_FAILED');const b=Buffer.from(await data.arrayBuffer());const file='object-'+String(i).padStart(6,'0')+'.aes';P.writeEncrypted(path.join(dir,file),b,key);objectManifest.push({bucket:o.bucket_id,name:o.name,file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}
  P.writeEncrypted(path.join(dir,'storage-manifest.json.aes'),JSON.stringify(objectManifest),key);
  await c.query('ROLLBACK');const after=(await c.query('SELECT bucket_id,name,metadata,updated_at FROM storage.objects ORDER BY bucket_id,name')).rows;if(JSON.stringify(after)!==JSON.stringify(objects))throw Error('STORAGE_CHANGED_DURING_BACKUP');
  result.serverVersion=info.version;result.tableCount=counts.length;result.storageObjectCount=objects.length;result.storageBytes=objectManifest.reduce((a,x)=>a+x.bytes,0);result.complete=true;result.databaseChanged=false;
  fs.writeFileSync(path.join(P.privateDir,'latest-backup-directory.txt'),dir);P.writeEncrypted(path.join(dir,'manifest.json.aes'),JSON.stringify(result),key);
 }finally{try{await c.query('ROLLBACK')}catch{}await c.end();result.finishedAt=new Date().toISOString();fs.writeFileSync('docs/release52-backup-result.json',JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(JSON.stringify(P.publicFailure(e)));process.exitCode=1});
