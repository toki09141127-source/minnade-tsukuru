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
await db.query("ROLLBACK");report.complete=true;
}catch(e){report.failure={code:e.code||"CHECK_FAILED",name:String(e.message).slice(0,100)};process.exitCode=1;}finally{if(db){await db.query("ROLLBACK").catch(()=>{});await db.end()}fs.writeFileSync("docs/v2-rc-staging-metadata.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({complete:report.complete,checks:report.checks.length,failure:report.failure}));}})();
