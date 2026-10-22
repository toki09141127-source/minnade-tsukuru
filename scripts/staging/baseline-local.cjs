/* eslint-disable @typescript-eslint/no-require-imports */
/** Local disposable PostgreSQL only. Private audited metadata is never logged or copied to docs.
 * Not a production dump/restore tool: grants, RLS, sequences, Auth and Storage remain partial.
 */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
async function main(){
 const input=process.env.MVP_BASELINE_METADATA,runtime=process.env.MVP_TEST_RUNTIME;
 if(!input||!runtime)throw Error('PRIVATE_INPUT_AND_RUNTIME_REQUIRED');
 const raw=fs.readFileSync(input,'utf8'),m=JSON.parse(raw);
 if(/eyJ[A-Za-z0-9_-]{20,}\.|sb_secret_|BEGIN.*PRIVATE KEY|https?:\/\//.test(raw))throw Error('PRIVATE_REVIEW_REQUIRED');
 const {Client}=require(path.join(runtime,'node_modules/pg'));
 const bin=path.join(runtime,'node_modules/@embedded-postgres/windows-x64/native/bin');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'minnade-baseline-local-'));
 const data=path.join(dir,'data'),socket=net.createServer();
 await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const run=(exe,args)=>{const r=spawnSync(path.join(bin,exe+'.exe'),args,{windowsHide:true,encoding:'utf8',timeout:30000});if(r.status!==0)throw Error('LOCAL_POSTGRES_FAILED');};
 const results={scope:'LOCAL ONLY; audited public structure with synthetic Auth stub; NOT staging PASS',sourceSha256:createHash('sha256').update(raw).digest('hex'),migrations:[],checks:[],limitations:['Auth users/uid are local stubs','Original client ACL deliberately closed; public policies retained','Storage policies not copied; managed platform remains separate','Sequence MAXVALUE uses type default to avoid JSON bigint precision loss','No production or staging network access']};
 let started=false,c,phase='start';
 try{
  run('initdb',['-D',data,'-U','fixture_admin','--auth=trust','--locale=C','--encoding=UTF8']);
  fs.appendFileSync(path.join(data,'postgresql.conf'),"\nlisten_addresses='127.0.0.1'\nport="+port+"\n");
  run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-w','start']);started=true;
  c=new Client({host:'127.0.0.1',port,user:'fixture_admin',database:'postgres'});await c.connect();
  await c.query("SET statement_timeout='10s'; SET lock_timeout='3s'; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
  phase='baseline';
  await c.query('BEGIN; SET LOCAL check_function_bodies=off;');
  const extra=JSON.parse(fs.readFileSync(path.join(path.dirname(input),'baseline-completion-2026-10-21.json'),'utf8'));
  await c.query(require('./baseline-render.cjs')(m,extra));
  await c.query('COMMIT');
  results.checks.push({name:'audited public structure restores locally',pass:true});
  const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(x=>/^2026102100\d\d_.*\.sql$/.test(x)&&Number(x.slice(8,12))<=18).sort();
  if(migrations.length!==18)throw Error('MIGRATION_COUNT_CHANGED');
  for(const file of migrations){
   phase=file;
   try{await c.query(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));results.migrations.push({file,pass:true});}
   catch(e){await c.query('ROLLBACK');results.migrations.push({file,pass:false,code:e.code||'ERROR'});throw e;}
  }
  phase='behavior';
  const testFile=path.join(__dirname,'baseline-behavior.cjs');
  if(fs.existsSync(testFile))await require(testFile)(c,results);
  if(process.env.MVP_CORE_REVIEW==='true'){
   phase='019';
   await c.query(fs.readFileSync(path.join(root,'supabase/migrations/202610210019_core_admission.sql'),'utf8'));
   await require('./core-local-behavior.cjs')(c,results);
   phase='020';
   await c.query(fs.readFileSync(path.join(root,'supabase/migrations/202610210020_deletion_privacy_preconditions.sql'),'utf8'));
   await require('./deletion-privacy-local.cjs')(c,results);
   if(process.env.MVP_CLIENT_READ_REVIEW==='true'){
    phase='021';
    await c.query(fs.readFileSync(path.join(root,'supabase/migrations/202610210021_client_read_contract.sql'),'utf8'));
    await require('./client-read-local.cjs')(c,results);
    phase='022';
    await c.query(fs.readFileSync(path.join(root,'supabase/migrations/202610210022_work_snapshot_read.sql'),'utf8'));
    await require('./work-read-local.cjs')(c,results);
    if(process.env.MVP_FINAL_DELETION_REVIEW==='true'){
     phase='023';await c.query(fs.readFileSync(path.join(root,'supabase/migrations/202610210023_retained_actors.sql'),'utf8'));
     phase='024';await c.query(fs.readFileSync(path.join(root,'supabase/migrations/202610210024_deletion_prepare.sql'),'utf8'));
     phase='final-deletion';await require('./deletion-final-local.cjs')(c,results);
     if(process.env.MVP_DELETION_PAUSE_REVIEW==='true'){phase='deletion-pause';await require('./deletion-pause-local.cjs')(c,results);}
     if(process.env.MVP_RELEASE_REVIEW==='true'){phase='release-consent';await require('./release-consent-local.cjs')(c,results);}
    }
   }
  }

 }catch(e){results.failure={phase,code:e.code||'LOCAL_VALIDATION_FAILED',constraint:e.constraint||null,message:/^[A-Z_]+$/.test(e.message||'')?e.message:undefined,context:phase==='final-deletion'?e.where:undefined};process.exitCode=1;}
 finally{
  if(c)await c.end();
  if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
  results.serverStopped=true;
  fs.writeFileSync(path.join(root,process.env.MVP_RELEASE_REVIEW==='true'?'docs/release-consent-local-result.json':process.env.MVP_DELETION_PAUSE_REVIEW==='true'?'docs/deletion-pause-local-result.json':'docs/staging-baseline-local-result.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
 }
}
main().catch(()=>{console.error('LOCAL_BASELINE_CHECK_FAILED');process.exitCode=1;});
