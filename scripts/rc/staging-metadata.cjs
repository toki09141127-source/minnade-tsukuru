/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require("fs"),assert=require("node:assert/strict");
(async()=>{let db;const report={complete:false,checks:[],productionChanges:"NONE",dataRead:"catalogs and control booleans only"};
const ok=(v,name)=>{assert.ok(v,name);report.checks.push({name,pass:true})};
try{const x=await require("../billing/db.cjs")();db=x.db;ok(x.ctx.ref==="fwqucffxdmbdczspkcyr","exact staging");await db.query("BEGIN READ ONLY");
const ex=(await db.query("SELECT extname FROM pg_extension WHERE extname=ANY($1)",[["pg_cron","pg_net","http","supabase_vault"]])).rows.map(r=>r.extname);
for(const n of ["pg_cron","pg_net","http","supabase_vault"])ok(ex.includes(n),"managed extension exists "+n);
for(const fn of ["public.buffer_scheduler_tick()","public.v25_admin_action(uuid,text,text,text,integer,jsonb,text,text)"]){const r=(await db.query("SELECT has_function_privilege('anon',$1,'EXECUTE') a,has_function_privilege('authenticated',$1,'EXECUTE') u,has_function_privilege('service_role',$1,'EXECUTE') s",[fn])).rows[0];ok(!r.a&&!r.s&&(fn.includes("admin")?r.u:!r.u),"managed RPC ACL "+fn.split("(")[0]);}
const fn=(await db.query("SELECT pg_get_functiondef('public.buffer_scheduler_tick()'::regprocedure) d")).rows[0].d;
ok(fn.includes("extensions.http(")&&!fn.includes("net.http_get"),"actual scheduler uses synchronous HTTP only");
ok(fn.includes("pg_try_advisory_xact_lock"),"actual scheduler concurrency lock");
ok((await db.query("SELECT enabled FROM buffer_scheduler_config")).rows[0].enabled===false,"staging scheduler OFF");
ok((await db.query("SELECT public.buffer_control_state() s")).rows[0].s.enabled===false,"staging Buffer OFF");
const names=["room_ai_creators","room_ai_tasks","room_ai_outputs","billing_accounts","ai_credit_ledger","admin_users","admin_audit"];
for(const n of names){const r=(await db.query("SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass($1)",["public."+n])).rows[0];ok(r?.relrowsecurity,"actual RLS "+n);}
const inventory=require('./migrations.cjs').inventory();
const created=[];for(const item of inventory.filter(x=>Number(x.number)>=42)){const sql=fs.readFileSync('supabase/migrations/'+item.file,'utf8');for(const match of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(public|mvp_private)\.(\w+)/gi))created.push(match[1]+'.'+match[2])}
report.rls=[];for(const name of [...new Set(created)]){const r=(await db.query("SELECT c.relrowsecurity rls,has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') anon_write,has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') user_write FROM pg_class c WHERE c.oid=to_regclass($1)",[name])).rows[0];ok(r?.rls&&!r.anon_write&&!r.user_write,'V2 table RLS and direct write deny '+name);report.rls.push({name,...r})}
ok(report.rls.length>=24,'all canonical V2 added tables enumerated');
report.authFk=(await db.query("SELECT t.relname,c.conname,c.confdeltype FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.contype='f' AND c.confrelid='auth.users'::regclass AND n.nspname='public' ORDER BY 1,2")).rows;
ok(report.authFk.every(r=>['profiles','public_profiles','billing_accounts'].includes(r.relname)),'Auth FK deletion allowlist preserved');
await db.query("ROLLBACK");report.complete=true;
}catch(e){report.failure={code:e.code||"CHECK_FAILED",name:String(e.message).slice(0,100)};process.exitCode=1;}finally{if(db){await db.query("ROLLBACK").catch(()=>{});await db.end()}fs.writeFileSync("docs/v2-rc-staging-metadata.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({complete:report.complete,checks:report.checks.length,failure:report.failure}));}})();
