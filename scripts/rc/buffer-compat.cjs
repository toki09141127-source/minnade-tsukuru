/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require("node:assert/strict");
module.exports=async function({db,report}){
 const ok=(name)=>report.checks.push({name,pass:true});
 const bad=await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'buffer_%' AND NOT rowsecurity");
 assert.equal(bad.rowCount,0);ok("integrated Buffer tables retain RLS");
 const flags=await db.query("SELECT enabled FROM public.buffer_scheduler_config");
 assert.equal(flags.rows[0].enabled,false);ok("fresh scheduler remains disabled");
 assert.equal((await db.query("SELECT buffer_scheduler_tick() value")).rows[0].value,null);ok("disabled integrated scheduler makes no HTTP call");
 assert.equal((await db.query("SELECT count(*)::int n FROM cron.job")).rows[0].n,0);ok("fresh migrations schedule no cron jobs");
 for(const role of ["anon","authenticated","service_role"]){
  await db.query("SET ROLE "+role);
  try{await assert.rejects(db.query("SELECT buffer_scheduler_tick()"),{code:"42501"});ok(role+" cannot invoke scheduler after V2/admin migrations");}
  finally{await db.query("RESET ROLE");}
 }
 const control=(await db.query("SELECT public.buffer_control_state() value")).rows[0].value;
 assert.equal(control.enabled,false);ok("Buffer auto-send remains OFF");
 const bypass=(await db.query("SELECT count(*)::int n FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'buffer_%' AND roles && ARRAY['anon','authenticated']::name[]")).rows[0].n;
 assert.equal(bypass,0);ok("V2 installs no direct client Buffer policies");
 const {randomUUID}=require("crypto"),ids=[randomUUID(),randomUUID()];
 for(const id of ids){await db.query("INSERT INTO auth.users(id) VALUES($1)",[id]);await db.query("BEGIN");await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query("SELECT mvp_accept_current_terms('2026-10-22','2026-10-22',true)");await db.query("COMMIT")}
 const as=async(id,sql,args=[])=>{await db.query("BEGIN");try{await db.query("SET LOCAL ROLE authenticated");await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);const r=await db.query(sql,args);await db.query("COMMIT");return r.rows[0]}catch(e){await db.query("ROLLBACK");throw e}};
 const room=(await as(ids[0],"SELECT v24_create_room($1,'TEST RC capacity','安全な架空の共同制作だけを検証するためのルームです。','novel',now()+interval '1 day',2,'forbidden','2026-10-22-v2.1',NULL) id",[randomUUID()])).id;
 assert.equal((await db.query("SELECT buffer_candidates() c")).rows[0].c.filter(x=>x.targetId===room).length,0);ok("V2 rooms remain opt-out until separate Buffer review");
 await db.query("INSERT INTO buffer_reviews(room_id,excluded,reviewed_hash,pii_clear,reviewed_at) VALUES($1,false,buffer_source_hash($1),true,now())",[room]);
 const candidate=async()=> (await db.query("SELECT buffer_candidates() c")).rows[0].c.find(x=>x.targetId===room&&x.kind==="new_room");
 assert.equal((await candidate()).seatsAvailable,1);ok("V2 Buffer capacity includes Creator");
 await as(ids[1],"SELECT v2_member_action($1,'join',NULL,NULL,'2026-10-22-v2.1')",[room]);
 assert.equal((await candidate()).seatsAvailable,0);ok("full V2 room has zero Buffer recruitment seats");
 await as(ids[1],"SELECT v2_member_action($1,'leave')",[room]);
 assert.equal((await candidate()).seatsAvailable,1);ok("left Member releases one Buffer seat");
 await db.query("UPDATE buffer_reviews SET excluded=true WHERE room_id=$1",[room]);
 assert.equal(await candidate(),undefined);ok("V2 Buffer opt-out removes candidate immediately");

};
