/* eslint-disable @typescript-eslint/no-require-imports */
const path=require('node:path');
const {load,databaseOptions}=require('./safety.cjs');
(async()=>{
 const c=load(),options=databaseOptions(c);
 if(!c.env.MVP_TEST_RUNTIME)throw Error('STAGING_PG_RUNTIME_REQUIRED');
 const {Client}=require(path.join(c.env.MVP_TEST_RUNTIME,'node_modules/pg'));
 const db=new Client(options);await db.connect();
 try{
  await db.query('BEGIN READ ONLY');
  const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
  // Counts only, after explicit fresh-project verification; never select user rows.
  const users=Number((await db.query('SELECT count(*) n FROM auth.users')).rows[0].n);
  const objects=Number((await db.query('SELECT count(*) n FROM storage.objects')).rows[0].n);
  const required=['rooms','posts','room_members','room_join_requests','profiles','public_profiles','events','event_members','decisions','novel_drafts','room_pre_archive_notes','reports','room_likes'];
  console.log(JSON.stringify({projectRef:c.ref,publicTables:tables,authUsers:users,storageObjects:objects,
   empty:tables.length===0&&users===0&&objects===0,missingBaseline:required.filter(t=>!tables.includes(t)),migrationApplied:false}));
  await db.query('ROLLBACK');
 }finally{await db.end()}
})().catch(e=>{console.error(/^STAGING_|^PRODUCTION_|^KEY_/.test(e.message)?e.message:'STAGING_DB_CHECK_FAILED');process.exitCode=1});
