/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit, ordered production rollout. No raw rows, secrets, SQL errors, or automatic retry.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),tls=require('node:tls');
const P=require('./private.cjs'),REF='joedeuyrzimqyjapqpyh';
async function main(){
 const [mode,confirm,range]=process.argv.slice(2);if(confirm!==REF||!['preflight','stop','apply','status','resume'].includes(mode))throw Error('EXPLICIT_PRODUCTION_TARGET_REQUIRED');
 const read=f=>JSON.parse(fs.readFileSync('docs/'+f));
 const b=read('release52-backup-result.json'),v=read('release52-restore-result.json');
 if(!b.complete||!v.complete||v.backupSha256!==b.database.sha256||v.migrationRehearsal?.length!==28||v.migrationRehearsal.some(x=>!x.pass))throw Error('BACKUP_RESTORE_REHEARSAL_GATE');
 for(const file of ['release52-maintenance-result.json','release52-global-stop-result.json','release52-global-resume-result.json'])if(!read(file).complete)throw Error('MAINTENANCE_GATE');
 const ctx=require('../staging/safety.cjs').load(),{Client}=require(path.join(ctx.env.MVP_TEST_RUNTIME,'node_modules/pg'));
 const c=new Client({host:'aws-1-ap-south-1.pooler.supabase.com',port:5432,user:'postgres.'+REF,password:P.password(),database:'postgres',ssl:{rejectUnauthorized:true,ca:tls.rootCertificates.join('\n')+'\n'+fs.readFileSync(path.join(P.privateDir,'supabase-prod-ca.crt'),'utf8')},application_name:'minnade_authorized_release52',connectionTimeoutMillis:15000,query_timeout:65000});
 const journalFile='docs/release52-production-migrations.json';const journal=fs.existsSync(journalFile)?JSON.parse(fs.readFileSync(journalFile)):{projectRef:REF,migrations:[]};if(journal.projectRef!==REF)throw Error('JOURNAL_TARGET_MISMATCH');
 const save=()=>fs.writeFileSync(journalFile,JSON.stringify(journal,null,2)+'\n');
 const scalar=async(sql,params)=>(await c.query(sql,params)).rows[0];
 const guard=async()=>scalar("SELECT count(*)::int AS count FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='mvp_release_stop' AND p.proname='reject_app_write'");
 try{
  await c.connect();const who=await scalar('SELECT current_user AS role,current_database() AS db');if(who.role!=='postgres'||who.db!=='postgres')throw Error('PRODUCTION_SESSION_REJECTED');await c.query("SET lock_timeout='10s'; SET statement_timeout='55s'");
  if(mode==='preflight'){
   await c.query('BEGIN READ ONLY');const facts=await scalar("SELECT (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS public_tables,to_regclass('public.attachment_uploads') IS NULL AS ledger_absent,to_regnamespace('mvp_private') IS NULL AS private_absent,(SELECT count(*)::int FROM (SELECT 1 FROM public.room_join_requests WHERE status='pending' GROUP BY room_id,user_id HAVING count(*)>1) q) AS pending_duplicates,(SELECT count(*)::int FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE k.contype='f' AND k.confrelid='auth.users'::regclass AND n.nspname='public' AND t.relname NOT IN ('profiles','public_profiles') AND (cardinality(k.conkey)<>1 OR t.relname<>ALL(ARRAY['decisions','event_members','events','novel_drafts','post_likes','posts','room_join_requests','room_members','room_pre_archive_notes','rooms','attachment_uploads']) OR (SELECT attname FROM pg_attribute WHERE attrelid=k.conrelid AND attnum=k.conkey[1])<>ALL(ARRAY['decided_by','user_id','created_by','updated_by','marked_by','approved_by','author_id']))) AS unknown_auth_fk");await c.query('ROLLBACK');
   const pass=facts.public_tables===14&&facts.ledger_absent&&facts.private_absent&&facts.pending_duplicates===0&&facts.unknown_auth_fk===0;fs.writeFileSync('docs/release52-production-preflight.json',JSON.stringify({projectRef:REF,at:new Date().toISOString(),facts,pass},null,2)+'\n');console.log(JSON.stringify({mode,...facts,pass}));if(!pass)throw Error('PRODUCTION_PREFLIGHT_FAILED');
  }else if(mode==='stop'){
   if(!read('release52-production-preflight.json').pass||journal.migrations.length)throw Error('INITIAL_PREFLIGHT_REQUIRED');
   let sql=fs.readFileSync('docs/release52-staging-stop.sql','utf8');sql=sql.replace('rehearsal target: fwqucffxdmbdczspkcyr ONLY.','approved production target: '+REF+'.').replace('SELECT public.mvp_set_deletion_pause(true);',()=>"DO $$ BEGIN IF to_regprocedure('public.mvp_set_deletion_pause(boolean)') IS NOT NULL THEN PERFORM public.mvp_set_deletion_pause(true); END IF; END $$;");
   await c.query(sql);const state=await guard();if(state.count!==17)throw Error('PRODUCTION_GUARD_COUNT_UNEXPECTED');console.log(JSON.stringify({mode,guardedTables:state.count}));
  }else if(mode==='apply'){
   const m=/^(\d{1,2})-(\d{1,2})$/.exec(range||'');if(!m)throw Error('SMALL_PHASE_RANGE_REQUIRED');const first=Number(m[1]),last=Number(m[2]);if(first<1||last>28||last<first||last-first>5)throw Error('SMALL_PHASE_RANGE_REQUIRED');
   if(journal.migrations.some(x=>x.state!=='applied')||first!==journal.migrations.length+1)throw Error('ORDER_OR_UNKNOWN_OUTCOME_REQUIRES_REVIEW');if((await guard()).count<17)throw Error('MAINTENANCE_REQUIRED');
   for(let number=first;number<=last;number++){
    const proof=v.migrationRehearsal[number-1],sql=fs.readFileSync('supabase/migrations/'+proof.file),hash=crypto.createHash('sha256').update(sql).digest('hex');if(hash!==proof.sha256)throw Error('MIGRATION_HASH_CHANGED');
    const entry={number,file:proof.file,sha256:hash,state:'started',startedAt:new Date().toISOString()};journal.migrations.push(entry);save();
    try{await c.query(sql.toString('utf8'));entry.state='applied';entry.finishedAt=new Date().toISOString();save()}catch(e){try{await c.query('ROLLBACK')}catch{}entry.state='failed_or_unknown';entry.error=P.publicFailure(e);save();throw Error('PRODUCTION_MIGRATION_STOP_'+number)}
    const tables=[...sql.toString().matchAll(/CREATE TABLE\s+(public|mvp_private)\.([a-z_]+)/g)].map(x=>x[1]+'.'+x[2]);
    for(const table of tables){const x=await scalar('SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass($1)',[table]);if(!x?.relrowsecurity)throw Error('NEW_TABLE_RLS_CHECK_FAILED')}
    entry.newTableRlsChecked=tables.length;save();console.log('APPLIED_AND_CHECKED '+String(number).padStart(3,'0'));
   }
   const status=await scalar("SELECT (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS public_tables,(SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'mvp_%') AS mvp_functions");journal.lastPhase={first,last,...status,at:new Date().toISOString()};save();console.log(JSON.stringify(journal.lastPhase));
  }else if(mode==='status'){
   console.log(JSON.stringify({mode,maintenance:await guard(),migrations:journal.migrations.length,allKnown:journal.migrations.every(x=>x.state==='applied')}));
  }else{
   if(journal.migrations.length!==28||journal.migrations.some(x=>x.state!=='applied'))throw Error('ALL_MIGRATIONS_REQUIRED');
   await c.query(fs.readFileSync('docs/release52-staging-resume.sql','utf8'));console.log(JSON.stringify({mode,maintenance:await guard(),deletionPaused:(await scalar('SELECT public.mvp_deletion_is_paused() AS paused')).paused}));
  }
 }finally{try{await c.query('ROLLBACK')}catch{}await c.end()}
}
main().catch(e=>{console.error(JSON.stringify(P.publicFailure(e)));process.exitCode=1});
