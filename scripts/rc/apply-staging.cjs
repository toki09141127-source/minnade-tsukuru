/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require("fs"),assert=require("node:assert/strict");
(async()=>{let db;const file="docs/v2-rc-staging-migrations.json";const r=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{projectRef:"fwqucffxdmbdczspkcyr",scope:"incremental RC only; legacy V2 history unchanged",productionChanges:"NONE",files:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(r,null,2)+"\n");
try{const x=await require("../billing/db.cjs")();db=x.db;assert.equal(x.ctx.ref,r.projectRef);assert.equal(process.argv[2],"apply-staging");
const e=require("./migrations.cjs").inventory().find(x=>x.number===58);
if(r.files.length){assert.equal(r.files[0].sha256,e.sha256);assert.equal(r.files[0].state,"applied","UNKNOWN_OUTCOME_REQUIRES_REVIEW");console.log("RC058_ALREADY_APPLIED");return}
await db.query("SELECT pg_advisory_lock(24240058)");await db.query("SET lock_timeout='5s'; SET statement_timeout='30s'");
assert.equal((await db.query("SELECT enabled FROM buffer_scheduler_config")).rows[0].enabled,false);
assert.equal((await db.query("SELECT enabled FROM buffer_control")).rows[0].enabled,false);
const def=(await db.query("SELECT pg_get_functiondef('buffer_candidates()'::regprocedure) d")).rows[0].d;
assert.ok(def.includes("45-")&&!def.includes("r.capacity"),"UNEXPECTED_PREVIOUS_DEFINITION");
r.files.push({file:e.file,sha256:e.sha256,state:"started"});save();
await db.query(fs.readFileSync("supabase/migrations/"+e.file,"utf8"));
r.files[0].state="applied";r.complete=true;save();console.log(JSON.stringify({complete:true,migration:58,productionChanges:"NONE",bufferSend:false}));
}catch(e){r.failure={code:e.code||"STAGING_APPLY_FAILED",name:/^[A-Z_]+$/.test(e.message)?e.message:"SAFE_REVIEW_REQUIRED"};save();process.exitCode=1;console.log(JSON.stringify(r.failure));}finally{if(db){await db.query("ROLLBACK").catch(()=>{});await db.end()}}})();
