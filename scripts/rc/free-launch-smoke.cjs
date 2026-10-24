/* eslint-disable @typescript-eslint/no-require-imports */
const x=require('./free-release-context.cjs');
(async()=>{let h;try{h=await require('./free-launch-smoke-context.cjs')('smoke');const {db,f,clients,admin,step,call,expect,denied,id,assert,save}=h;
await step('TEST_LOGIN_PROFILE_AND_CURRENT_CONSENT',async()=>{
 const r=await call(0,'/profile/set-username',{username:'test'+f.runId.replaceAll('-','').slice(0,12)});expect(r);
 for(const p of ['/','/login','/profile','/rooms','/pricing'])expect(await call(null,p,null,'HEAD'));
 const read=await clients[0].from('profiles').select('id').eq('id',f.users[0].id);assert.ok(!read.error&&read.data.length===1);
});
await step('TEMP_TEST_OPERATOR_AUDITED',async()=>{
 await db.query('BEGIN');await db.query("INSERT INTO admin_users(user_id,role,active) VALUES($1,'owner',true)",[f.users[3].id]);await db.query("INSERT INTO moderation_operators(user_id) VALUES($1)",[f.users[3].id]);
 await db.query("INSERT INTO admin_audit(request_id,actor_id,actor_role,action,target_type,target_id,before_state,after_state,reason,request_hash) VALUES($1,$2::uuid,'owner','bootstrap','staff',($2::uuid)::text,'{}','{\"role\":\"owner\",\"active\":true,\"temporary_test\":true}','operational',$3)",[id('test-owner'),f.users[3].id,h.crypto.createHash('sha256').update(f.runId).digest('hex')]);await db.query('COMMIT');
});
await step('V2_FREE_ROOM_CREATE_WITH_AI_OFF',async()=>{
 const r=await call(0,'/api/v2/create',{requestId:id('room'),title:'TEST FREE V2 '+f.runId.slice(0,8),description:'仲間たちが小さな町で発見する物語を制作する、公開前確認用の架空作品です。',genre:'novel',capacity:10,deadline:new Date(Date.now()+86400000).toISOString(),aiLevel:'forbidden',consent:true});expect(r);assert.ok(r.data.data);f.room=r.data.data;save();
 const room=(await db.query('SELECT v2_enabled,created_by FROM rooms WHERE id=$1',[f.room])).rows[0];assert.ok(room.v2_enabled&&room.created_by===f.users[0].id);
});
await step('JOIN_CONSENT_REQUIRED_AND_MEMBER_ACCEPTED',async()=>{
 denied(await call(1,'/api/v2/member',{roomId:f.room,action:'join'}));
 expect(await call(1,'/api/v2/member',{roomId:f.room,action:'join',consent:'2026-10-22-v2.1'}));
});
await step('TEXT_POST_AND_MEMBER_HIGHLIGHT_DENIED',async()=>{
 const r=await call(1,'/api/posts/create',{roomId:f.room,content:'TEST FREE V2 人間の共同制作ログ',post_type:'log',requestId:id('text')});expect(r);f.textPost=r.data.postId;save();
 denied(await call(1,'/api/v2/post',{roomId:f.room,postId:f.textPost,action:'highlight',expected:false}));
});
const upload=async()=>{const bytes=await require('sharp')({create:{width:8,height:8,channels:3,background:{r:20,g:140,b:80}}}).png().toBuffer();const form=new FormData();form.set('roomId',f.room);form.set('file',new Blob([bytes],{type:'image/png'}),'test-v2.png');const r=await call(1,'/api/uploads',form);expect(r);return r.data};
await step('ATTACHMENT_LEDGER_UPLOAD_BOUND_AND_UNUSED',async()=>{
 f.used=await upload();f.unused=await upload();save();const r=await call(1,'/api/posts/create',{roomId:f.room,content:'TEST FREE V2 synthetic image',uploadId:f.used.uploadId,post_type:'log',requestId:id('image')});expect(r);f.imagePost=r.data.postId;save();
 const signed=await call(1,'/api/uploads/sign',{postId:f.imagePost});expect(signed);assert.equal(new URL(signed.data.signedUrl).origin,h.env().NEXT_PUBLIC_SUPABASE_URL);const b=Buffer.from(await (await fetch(signed.data.signedUrl)).arrayBuffer());f.usedHash=h.crypto.createHash('sha256').update(b).digest('hex');save();
});
await step('CORE_REQUEST_REJECT_THEN_APPROVE',async()=>{
 let r=await call(1,'/api/v2/member',{roomId:f.room,action:'apply_core',consent:'2026-10-22-v2.1'});expect(r);
 denied(await call(2,'/api/v2/member',{roomId:f.room,action:'approve_core',requestId:r.data.data.requestId}));
 expect(await call(0,'/api/v2/member',{roomId:f.room,action:'reject_core',requestId:r.data.data.requestId}));
 r=await call(1,'/api/v2/member',{roomId:f.room,action:'apply_core',consent:'2026-10-22-v2.1'});expect(r);
 expect(await call(0,'/api/v2/member',{roomId:f.room,action:'approve_core',requestId:r.data.data.requestId}));
});
await step('HIGHLIGHT_PUBLIC_APPROVAL_LOG_SEARCH_AND_DRAFT',async()=>{
 expect(await call(1,'/api/v2/post',{roomId:f.room,postId:f.textPost,action:'highlight',expected:false}));
 expect(await call(1,'/api/v2/post',{roomId:f.room,postId:f.imagePost,action:'approve_public',reviewed:true}));
 const log=await call(1,'/api/v2/log?roomId='+f.room+'&q=TEST&filter=mine');expect(log);assert.ok(log.data.posts.some(p=>p.id===f.textPost));
 const v=(await db.query('SELECT version FROM work_drafts WHERE room_id=$1',[f.room])).rows[0]?.version||0;
 expect(await call(1,'/api/v2/draft',{roomId:f.room,version:v,reviewed:true,blocks:[{id:'body',type:'text',text:'TEST FREE V2 shared published work'},{id:'image',type:'image',postId:f.imagePost}]}));
});
await step('AI_AND_PAID_CHECKOUT_UNAVAILABLE',async()=>{
 expect(await call(0,'/api/v2/ai',{roomId:f.room,requestId:id('ai'),kind:'question',text:'TEST'}),503);
 expect(await call(0,'/api/billing',{action:'checkout',plan:'plus',cycle:'month',requestId:id('billing')}),503);
 const state=await clients[0].rpc('v24_billing_state');assert.ok(!state.error);assert.equal((await db.query('SELECT plan FROM billing_accounts WHERE owner_id=$1',[f.users[0].id])).rows[0].plan,'free');
 assert.equal((await db.query('SELECT enabled FROM mvp_private.ai_control')).rows[0].enabled,false);
 assert.equal((await db.query("SELECT count(*)::int n FROM room_ai_tasks WHERE room_id=$1 AND status IN ('running','succeeded')",[f.room])).rows[0].n,0);
});
await step('FEATURE_STOP_POSTS_UPLOADS_AND_DELETION',async()=>{
 for(const name of ['posts','uploads']){await h.feature(name,false);try{if(name==='posts')expect(await call(1,'/api/posts/create',{roomId:f.room,content:'TEST blocked',requestId:id('blocked-post')}),503);else{const form=new FormData();form.set('roomId',f.room);form.set('file',new Blob(['TEST'],{type:'text/plain'}),'test.txt');expect(await call(1,'/api/uploads',form),503)}}finally{await h.feature(name,true)}}
 expect(await call(1,'/api/account/delete',{confirm:true,attribution:'anonymous',policyVersion:'withdrawal-draft-2026-10-21'}),503);
});
await step('FORCED_PUBLISH_STOP_THEN_HUMAN_FALLBACK',async()=>{
 await db.query('BEGIN');await db.query("SET LOCAL session_replication_role='replica'");const changed=await db.query("UPDATE rooms SET expires_at=now()-interval '1 minute' WHERE id=$1 AND created_by=$2 AND v2_enabled",[f.room,f.users[0].id]);assert.equal(changed.rowCount,1);await db.query('COMMIT');
 await h.feature('forced_publish',false);try{assert.ok((await admin.rpc('v22_publish_room',{p_room:f.room})).error)}finally{await h.feature('forced_publish',true)}
 const a=await admin.rpc('v22_publish_room',{p_room:f.room});assert.ok(!a.error);assert.equal(a.data,1);
 const b=await admin.rpc('v22_publish_room',{p_room:f.room});assert.ok(!b.error);assert.equal(b.data,0);
});
await step('PUBLIC_WORK_LOG_ATTACHMENT_LIKE_REPORT',async()=>{
 const w=await call(null,'/api/v2/work?roomId='+f.room);expect(w);assert.ok(w.data.blocks.some(b=>b.text==='TEST FREE V2 shared published work'));
 expect(await call(null,'/works/'+f.room,null,'HEAD'));expect(await call(null,'/works/'+f.room+'/log',null,'HEAD'));expect(await call(null,'/api/v2/log?roomId='+f.room));
 const s=await call(null,'/api/storage/sign',{postId:f.imagePost});expect(s);const b=Buffer.from(await (await fetch(s.data.signedUrl)).arrayBuffer());assert.equal(h.crypto.createHash('sha256').update(b).digest('hex'),f.usedHash);
 expect(await call(1,'/api/rooms/like',{roomId:f.room,desired:true,expected:false,requestId:id('like')}));
 const report=await call(1,'/api/reports/create',{targetType:'room',targetId:f.room,reason:'TEST Free V2 acceptance',requestId:id('report')});expect(report);f.receipt=report.data.receiptId;save();
});
await step('ADMIN_SECTIONS_AND_REGULAR_USER_DENIAL',async()=>{
 expect(await call(null,'/api/admin'),401);expect(await call(2,'/api/admin'),403);
 for(const section of ['overview','reports','users','rooms','works','system','audit']){const r=await call(3,'/api/admin?section='+section+'&query=TEST&target='+f.room);expect(r)}
});
const acct=await clients[1].rpc('v24_billing_state');assert.ok(!acct.error);f.memberBillingId=(await db.query('SELECT id FROM billing_accounts WHERE owner_id=$1',[f.users[1].id])).rows[0].id;h.save();
h.out.complete=true;h.out.finishedAt=new Date().toISOString();h.save();
}catch(e){if(h){h.out.failure=h.P.publicFailure(e);h.save()}console.log(JSON.stringify({complete:false,...x.P.publicFailure(e)}));process.exitCode=1}finally{if(h)await h.close()}})();
