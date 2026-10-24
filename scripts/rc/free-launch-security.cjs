/* eslint-disable @typescript-eslint/no-require-imports */
const x=require('./free-release-context.cjs');
(async()=>{let h;try{h=await require('./free-launch-smoke-context.cjs')('security');const {db,f,clients,step,call,expect,denied,id,assert}=h;
await step('FOREIGN_ROOM_AND_DRAFT_DENIED',async()=>{
 const r=await call(2,'/api/v2/create',{requestId:id('security-room'),title:'TEST Free V2 permissions',description:'本番公開の権限境界を確認するための、実在しない町の共同制作テストです。',genre:'novel',capacity:10,deadline:new Date(Date.now()+86400000).toISOString(),aiLevel:'forbidden',consent:true});expect(r);f.securityRoom=r.data.data;h.save();
 denied(await call(1,'/api/posts/create',{roomId:f.securityRoom,content:'TEST forbidden',requestId:id('foreign-post')}));
 denied(await call(1,'/api/v2/draft',{roomId:f.securityRoom,version:0,reviewed:true,blocks:[{id:'body',type:'text',text:'TEST forbidden'}]}));
});
await step('MEMBER_HIGHLIGHT_CORE_KICK_AND_KICKED_REJOIN_DENIED',async()=>{
 const room=f.securityRoom;
 for(const i of [0,1])expect(await call(i,'/api/v2/member',{roomId:room,action:'join',consent:'2026-10-22-v2.1'}));
 const r=await call(0,'/api/posts/create',{roomId:room,content:'TEST member guard',requestId:id('member-guard')});expect(r);
 denied(await call(0,'/api/v2/post',{roomId:room,postId:r.data.postId,action:'highlight',expected:false}));
 const req=await call(1,'/api/v2/member',{roomId:room,action:'apply_core',consent:'2026-10-22-v2.1'});expect(req);
 expect(await call(2,'/api/v2/member',{roomId:room,action:'approve_core',requestId:req.data.data.requestId}));
 denied(await call(1,'/api/v2/member',{roomId:room,action:'kick',target:f.users[0].id}));
 expect(await call(2,'/api/v2/member',{roomId:room,action:'kick',target:f.users[0].id}));
 denied(await call(0,'/api/v2/member',{roomId:room,action:'join',consent:'2026-10-22-v2.1'}));
 // The retiring Core must have no active-room lock; close only this exact synthetic room.
 await db.query('BEGIN');await db.query("SET LOCAL session_replication_role='replica'");assert.equal((await db.query("UPDATE rooms SET expires_at=now()-interval '1 minute' WHERE id=$1 AND created_by=$2",[room,f.users[2].id])).rowCount,1);await db.query('COMMIT');
 const p=await h.admin.rpc('v22_publish_room',{p_room:room});assert.ok(!p.error);
});
await step('SUSPENDED_WRITES_REJECTED',async()=>{
 await db.query("INSERT INTO admin_suspensions(user_id,suspended,changed_by,reason) VALUES($1,true,$2,'operational')",[f.users[2].id,f.users[3].id]);
 try{denied(await call(2,'/api/v2/create',{requestId:id('suspended'),title:'TEST denied',description:'権限拒否を確認するためだけの架空の共同制作テストルームです。',genre:'novel',capacity:10,deadline:new Date(Date.now()+86400000).toISOString(),aiLevel:'forbidden',consent:true}))}finally{await db.query('DELETE FROM admin_suspensions WHERE user_id=$1',[f.users[2].id])}
});
await step('HIDDEN_WORK_PUBLIC_LEAK_DENIED',async()=>{
 const s=await call(3,'/api/admin?section=works&target='+f.room);expect(s);
 const detail=s.data.items?.find(v=>v.id===f.room);assert.ok(detail&&Number.isInteger(detail.version),'ADMIN_VERSION_REQUIRED');
 const action=async(version,value)=>{const request=h.crypto.randomUUID();await db.query('INSERT INTO mvp_release_stop.test_objects VALUES($1) ON CONFLICT DO NOTHING',[request]);const r=await call(3,'/api/admin',{confirm:true,request,action:'hide',type:'work',target:f.room,version,value,reason:'other',note:'TEST exact Work visibility'});expect(r);return r};
 await action(detail.version,true);try{expect(await call(null,'/api/v2/work?roomId='+f.room),404);const r=await call(null,'/api/v2/log?roomId='+f.room);assert.ok(r.status>=400||r.data.posts.length===0)}finally{const latest=await call(3,'/api/admin?section=works&target='+f.room);expect(latest);await action(latest.data.items.find(v=>v.id===f.room).version,false)}
});
await step('DIRECT_PLAN_ADMIN_AUDIT_STORAGE_PRIVILEGE_DENIED',async()=>{
 const u=f.users[2].id;
 assert.ok((await clients[2].from('admin_users').insert({user_id:u,role:'owner'})).error);
 assert.ok((await clients[2].from('admin_audit').insert({request_id:id('forged'),actor_id:u})).error);
 assert.ok((await clients[2].from('billing_accounts').update({plan:'pro'}).eq('owner_id',u)).error);
 assert.ok((await clients[2].from('room_members').update({role:'creator'}).eq('room_id',f.room).eq('user_id',f.users[1].id)).error);
 assert.ok((await clients[2].storage.from('room_uploads').download(f.used.storagePath)).error);
 expect(await call(2,'/api/admin'),403);expect(await call(2,'/api/v2/ai',{roomId:f.room,requestId:id('cross-ai'),kind:'question',text:'TEST'}),503);
});
await step('NEW_TABLE_RLS_AND_GRANT_BOUNDARIES',async()=>{
 const before=x.privateRead('v2-free-legacy-fingerprints.aes').columns.filter(v=>v.s==='public').map(v=>v.t);
 const rows=(await db.query("SELECT c.relname,c.relrowsecurity rls,has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') a,has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') u FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relname=ANY($1)",[[...new Set(before)]])).rows;
 const expected=require('./migrations.cjs').inventory().filter(e=>e.number>=42&&e.number<=59).flatMap(e=>[...x.fs.readFileSync('supabase/migrations/'+e.file,'utf8').matchAll(/CREATE TABLE public\.([a-z0-9_]+)/g)].map(m=>m[1])).sort();
 assert.deepEqual(rows.map(r=>r.relname).sort(),expected);assert.ok(rows.every(r=>r.rls&&!r.a&&!r.u));
 const privateNames=['ai_control','billing_config','admin_control','admin_rate'];
 const privateRows=(await db.query("SELECT relname,relrowsecurity rls,has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') a,has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') u FROM pg_class WHERE relnamespace='mvp_private'::regnamespace AND relname=ANY($1)",[privateNames])).rows;
 assert.deepEqual(privateRows.map(r=>r.relname).sort(),privateNames.sort());assert.ok(privateRows.every(r=>r.rls&&!r.a&&!r.u));h.out.privateRlsTables=privateRows.length;
 h.out.newRlsTables=rows.length;
});
await step('BUFFER_STATE_AND_NO_EXTERNAL_DISPATCH',async()=>{
 const b=(await db.query("SELECT (SELECT enabled FROM buffer_control) enabled,(SELECT count(*)::int FROM buffer_queue WHERE state IN ('sending','unknown')) uncertain")).rows[0];assert.equal(b.enabled,false);assert.equal(b.uncertain,0);
});
h.out.complete=true;h.out.finishedAt=new Date().toISOString();h.save();
}catch(e){if(h){h.out.failure=h.P.publicFailure(e);h.save()}console.log(JSON.stringify({complete:false,...x.P.publicFailure(e)}));process.exitCode=1}finally{if(h)await h.close()}})();
