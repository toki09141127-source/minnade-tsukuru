/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require("fs"),assert=require("node:assert/strict"),{randomUUID}=require("crypto"),{createClient}=require("@supabase/supabase-js");
(async()=>{let h,db,phase="setup",initial,feature;const hosted=process.argv.includes("--preview"),out={complete:false,scope:hosted?"Hosted RC + staging":"local RC build + staging",checks:[],productionChanges:"NONE",realAiCalls:0};
const file="docs/v2-rc-integrated-"+(hosted?"preview":"local")+".json",save=()=>fs.writeFileSync(file,JSON.stringify(out,null,2)+"\n");
if(process.argv.includes("--resume")&&fs.existsSync(file)){const previous=JSON.parse(fs.readFileSync(file));out.checks=previous.checks;out.previousFailure=previous.failure;}
const ok=name=>{out.checks.push({name,pass:true});save();console.log("PASS "+name)};
try{
 h=await require("./harness.cjs")();db=(await require("../billing/db.cjs")()).db;const f=h.f,users=Object.fromEntries(f.users.map(u=>[u.label,u])),clients={},tokens={};
 const cookie=hosted?require("./preview-scope.cjs").access().cookies.map(c=>c.name+"="+c.value).join("; "):"";
 for(const label of ["owner","moderator","free","core","kicked","outsider","suspended","departing"]){const u=users[label];assert.match(u.email,/^v2rc-.*@example\.invalid$/);const c=createClient(h.ctx.url,h.ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const r=await c.auth.signInWithPassword({email:u.email,password:u.password});assert.ok(!r.error,"LOGIN");tokens[label]=r.data.session.access_token;clients[label]=c}
 const api=async(label,path,body)=>{const headers={...(cookie?{Cookie:cookie}:{}),...(label?{Authorization:"Bearer "+tokens[label]}:{})};if(body&&!(body instanceof FormData)){headers["Content-Type"]="application/json";headers.Origin=h.base;body=JSON.stringify(body)}const r=await fetch(h.base+path,{method:body?"POST":"GET",headers,body,redirect:"error"});return {status:r.status,body:await r.json()}};
 feature=async(name,value)=>{const r=await clients.owner.rpc("v25_admin_read",{p_section:"system"});assert.ok(!r.error&&!r.data.error);const a=await clients.owner.rpc("v25_admin_action",{p_request:randomUUID(),p_action:"feature",p_type:"system",p_target:name,p_version:r.data.detail.version,p_value:value,p_reason:"operational",p_note:"RC synthetic acceptance; restore after"});assert.ok(!a.error&&!a.data.error,"FEATURE")};
 initial=(await db.query("SELECT mvp_private.v25_flags() f")).rows[0].f;
 await feature("ai",true);
 const owner=await h.page(users.free),member=await h.page(users.kicked);
 let room;
 if(process.argv.includes("--resume")){room=f.integrated.filter(x=>x.scope===(hosted?"preview":"local")).at(-1).room;}else{
 ok("A synthetic confirmed users login through actual UI");
 phase="room UI";
 const title="TEST RC "+randomUUID().slice(0,8);
 await owner.goto(h.base+"/rooms/create");await owner.getByLabel("タイトル",{exact:true}).fill(title);await owner.getByLabel("何をつくりたい？",{exact:true}).fill("架空の町に暮らす仲間たちの、小さな発見を共同制作する検収用の物語です。");await owner.getByLabel("定員",{exact:true}).selectOption("10");await owner.getByLabel("制作期間",{exact:true}).selectOption("48");await owner.getByRole("radio",{name:/AI補助可/}).check();await owner.getByRole("checkbox").check();await owner.getByRole("button",{name:"ルームを作る",exact:true}).click();await owner.waitForURL(/\/rooms\/[0-9a-f-]{36}$/, {timeout:60000});
 room=new URL(owner.url()).pathname.split("/").pop();f.integrated??=[];f.integrated.push({room,scope:hosted?"preview":"local"});fs.writeFileSync(".staging-private/v2rc-e2e.json",JSON.stringify(f));
 ok("B Free Creator creates room through consent UI");
 await member.goto(h.base+"/rooms/"+room);const join=member.getByRole("button",{name:"Memberとして参加",exact:true}).first();await join.waitFor();assert.ok(await join.isDisabled());await member.locator("header").getByRole("checkbox").check();await join.click();await member.getByLabel("制作ログに投稿",{exact:true}).waitFor();await member.getByLabel("制作ログに投稿",{exact:true}).fill("TEST RC 仲間と森の場面を考えました。");await member.getByRole("button",{name:"投稿する",exact:true}).click();await member.getByText("投稿しました。",{exact:true}).waitFor();ok("C Member consent and human post UI");
 await member.getByLabel("本文・投稿者を検索").fill("森の場面");await member.getByRole("button",{name:"検索",exact:true}).click();await member.getByLabel("表示する投稿").selectOption("mine");await member.getByText("TEST RC 仲間と森の場面を考えました。",{exact:true}).first().waitFor();ok("E production log search and own-post filter");
 const joinCore=await api("core","/api/v2/member",{roomId:room,action:"join",consent:"2026-10-22-v2.1"});assert.equal(joinCore.status,200);
 const req=await api("core","/api/v2/member",{roomId:room,action:"apply_core",consent:"2026-10-22-v2.1"});assert.equal(req.status,200);
 assert.equal((await api("free","/api/v2/member",{roomId:room,action:"approve_core",requestId:req.body.data.requestId})).status,200);ok("D Core application and Creator approval through RC APIs");
 const png=await require("sharp")({create:{width:2,height:2,channels:3,background:{r:30,g:120,b:190}}}).png().toBuffer(),form=new FormData();form.append("roomId",room);form.append("file",new Blob([png],{type:"image/png"}),"rc-synthetic.png");
 const upload=await api("kicked","/api/uploads",form);assert.equal(upload.status,200,"UPLOAD");
 const post=await api("kicked","/api/posts/create",{roomId:room,content:"TEST RC synthetic image",post_type:"log",uploadId:upload.body.uploadId,requestId:randomUUID()});assert.equal(post.status,200,"POST_IMAGE");ok("C ledger-backed synthetic image attachment");
 phase="AI";
 const read=async()=> (await api("free","/api/v2/ai?roomId="+room)).body;
 const wait=async fn=>{for(let n=0;n<45;n++){const s=await read();if(fn(s))return s;await new Promise(r=>setTimeout(r,1000))}throw Error("AI_TIMEOUT")};
 await wait(s=>s.outputs?.some(x=>x.trigger_type==="greeting"));ok("F synthetic greeting completes through RC worker");
 const credit=()=>api("free","/api/billing");
 const before=(await credit()).body.credits;
 const ai=await api("core","/api/v2/ai",{roomId:room,requestId:randomUUID(),kind:"question",text:"今の制作を整理してください"});assert.equal(ai.status,202,"AI_CORE");
 await wait(s=>s.tasks.some(t=>t.id===ai.body.taskId&&t.status==="succeeded"));
 const after=(await credit()).body.credits;assert.ok(after.consumed>before.consumed,"CREATOR_CREDIT");ok("L/O Core synthetic AI consumes Creator shared credit");
 assert.equal((await api("kicked","/api/v2/ai",{roomId:room,requestId:randomUUID(),kind:"question",text:"今の制作を整理してください"})).status,403);assert.equal((await api("outsider","/api/v2/ai?roomId="+room)).status,403);ok("H Member invocation and cross-room AI reads denied");
 const draft=await api("free","/api/v2/ai",{roomId:room,requestId:randomUUID(),kind:"draft_assist",text:"今の制作を整理してください"});assert.equal(draft.status,202,"DRAFT_AI");const ds=await wait(s=>s.tasks.some(t=>t.id===draft.body.taskId&&t.status==="succeeded")),proposal=ds.outputs.find(x=>x.kind==="draft_assist");assert.ok(proposal,"PROPOSAL");
 await owner.reload();await owner.getByRole("button",{name:"AIに聞く ↗",exact:true}).click();await owner.getByRole("button",{name:"AI発言・履歴",exact:true}).click();await owner.getByRole("button",{name:"編集して採用を確認",exact:true}).click();await owner.getByLabel("個人情報・権利・内容を確認して採用します").check();await owner.getByRole("button",{name:"確認してドラフトへ追加",exact:true}).click();await owner.getByRole("heading",{name:"提案を編集してドラフト末尾へ追加"}).waitFor({state:"hidden"});ok("I AI proposal requires human review and saves through UI");
 }
 const forbidden=await api("outsider","/api/v2/create",{requestId:randomUUID(),title:"TEST RC forbidden",description:"AIを使用しない人間だけの共同制作を検証するためのルームです。",genre:"novel",capacity:10,deadline:new Date(Date.now()+86400000).toISOString(),aiLevel:"forbidden",consent:true});assert.equal(forbidden.status,200);f.integrated.at(-1).forbidden=forbidden.body.data;fs.writeFileSync(".staging-private/v2rc-e2e.json",JSON.stringify(f));const fr=(await api("outsider","/api/v2/ai?roomId="+forbidden.body.data)).body;assert.equal(fr.identity,null);assert.equal(fr.tasks.length,0);ok("G AI-forbidden room has no identity/task/provider call");
 phase="stop";
 await feature("ai",false);assert.equal((await api("free","/api/v2/ai",{roomId:room,requestId:randomUUID(),kind:"question",text:"整理してください"})).status,503);assert.equal((await api("free","/api/posts/create",{roomId:room,content:"TEST RC human continues",post_type:"log",requestId:randomUUID()})).status,200);ok("S Owner AI stop rejects AI but preserves human creation");
 assert.equal((await api("free","/api/v2/member",{roomId:room,action:"kick",target:users.kicked.id})).status,200);assert.equal((await api("kicked","/api/posts/create",{roomId:room,content:"TEST rejected",post_type:"log",requestId:randomUUID()})).status,403);ok("D kicked Member loses posting permission");
 phase="publish";
 await db.query("BEGIN");await db.query("SET LOCAL session_replication_role='replica'");await db.query("UPDATE rooms SET expires_at=now()-interval '1 minute' WHERE id=$1 AND v2_enabled",[room]);await db.query("COMMIT");await db.query("SELECT v22_publish_room($1)",[room]);await db.query("SELECT v22_publish_room($1)",[room]);ok("J forced publication works with AI stopped and duplicate invocation");
 await owner.goto(h.base+"/works/"+room);await owner.getByRole("link",{name:"この作品ができるまで",exact:true}).click();await owner.getByRole("heading",{name:"公開制作ログ",exact:true}).waitFor();ok("K published Work opens public production log");
 const count=(await db.query("SELECT count(*)::int n FROM ai_credit_ledger l JOIN room_ai_tasks t ON t.id=l.task_id WHERE t.room_id=$1 AND l.source='system' AND l.credit_delta<>0",[room])).rows[0].n;assert.equal(count,0);ok("L system AI never charges manual credits");
 const axe=fs.readFileSync(".staging-private/ui-tools/node_modules/axe-core/axe.min.js","utf8");out.widths=[320,375,390,768,1024,1440];out.axeViolations=0;
 for(const [name,url] of [["home","/"],["rooms","/rooms"],["pricing","/pricing"],["room","/rooms/"+forbidden.body.data],["work","/works/"+room],["log","/works/"+room+"/log"],["billing","/billing"]]){await owner.goto(h.base+url);await owner.locator("h1").first().waitFor();for(const width of out.widths){await owner.setViewportSize({width,height:1000});assert.ok(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"OVERFLOW_"+name+"_"+width)}await owner.addScriptTag({content:axe});const n=await owner.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.length);out.axeViolations+=n;assert.equal(n,0,"AXE_"+name);ok("UI "+name+" six widths and axe")}
 assert.equal(h.errors.length,0);assert.equal(h.browserMetrics.hydrationErrors,0);assert.equal(h.http500.length,0);ok("Browser no uncaught/hydration/5xx errors");
 out.complete=true;
}catch(e){out.failure={phase,actual:typeof e.actual==="number"?e.actual:undefined,expected:typeof e.expected==="number"?e.expected:undefined,code:e.code||"CHECK_FAILED",name:/^[A-Z_0-9]+$/.test(e.message)?e.message:"ASSERTION_FAILED"};console.log(JSON.stringify(out.failure));process.exitCode=1}
finally{if(initial&&feature)try{const current=(await db.query("SELECT mvp_private.v25_flags() f")).rows[0].f;if(current.ai!==initial.ai)await feature("ai",initial.ai);out.flagsRestored=true}catch{out.flagsRestored=false;out.complete=false;process.exitCode=1}if(h){await h.close();out.browserClosed=true}if(db){await db.query("ROLLBACK").catch(()=>{});await db.end()}save()}})();
