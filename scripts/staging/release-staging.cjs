/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js'),{load}=require('./safety.cjs');
(async()=>{
 const ctx=load(),options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(ctx.url,ctx.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const r={runId:crypto.randomUUID(),projectRef:ctx.ref,scope:'Synthetic staging accounts only; NOT real email/physical device',checks:[],complete:false};
 const credentials=[],clients=[];const save=()=>{fs.writeFileSync('.staging-private/release-staging-fixture.json',JSON.stringify({runId:r.runId,credentials}));fs.writeFileSync('docs/release-staging-result.json',JSON.stringify(r,null,2))};
 const ok=(v,name)=>{assert(v,name);r.checks.push({name,pass:true});save();console.log('PASS '+name)};
 try{
 for(const alias of ['creator','member','other']){const email='release-'+alias+'-'+r.runId+'@example.invalid',password=crypto.randomBytes(32).toString('base64url');const x=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{synthetic:true}});assert(!x.error&&x.data.user,'SEED');credentials.push({alias,id:x.data.user.id,email,password});save();const client=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);assert(!(await client.auth.signInWithPassword({email,password})).error);clients.push(client)}
 ok(true,'Synthetic Auth login succeeds');
 const terms={p_terms:'2026-10-22',p_privacy:'2026-10-22',p_adult:true};
 ok(!!(await clients[0].rpc('mvp_accept_current_terms',{...terms,p_adult:false})).error,'False age denied');
 ok(!!(await clients[0].rpc('mvp_accept_current_terms',{...terms,p_terms:'2026-03-24'})).error,'Old terms denied');
 ok(!!(await clients[0].rpc('mvp_accept_current_terms',{p_terms:'2026-03-24',p_privacy:'2026-03-24'})).error,'Old consent signature denied');
 for(const c of clients)assert(!(await c.rpc('mvp_accept_current_terms',terms)).error,'CONSENT');ok(true,'Current age and terms stored through own authenticated RPC');
 const profile=await clients[1].from('profiles').select('id,adult_confirmed_at,terms_version');ok(!profile.error&&profile.data.length===1&&profile.data[0].id===credentials[1].id&&!!profile.data[0].adult_confirmed_at,'Attestation visible only to self');
 ok(!!(await admin.rpc('mvp_accept_current_terms',terms)).error,'Service Role cannot forge age attestation');
 const room=await admin.rpc('mvp_create_room',{p_actor:credentials[0].id,p_request:crypto.randomUUID(),p_settings:{title:'TEST release consent '+r.runId.slice(0,8),category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'}});assert(!room.error,'ROOM');r.roomId=room.data;ok(true,'Creator with age consent creates room');
 const join={p_actor:credentials[1].id,p_room:r.roomId,p_terms:'2026-10-22'};
 ok(!!(await admin.rpc('mvp_join_member',{...join,p_terms:'2026-03-24'})).error,'Old publication consent cannot join');
 ok(!(await admin.rpc('mvp_join_member',join)).error,'New publication consent joins');
 const req=await admin.rpc('mvp_request_core',join);assert(!req.error,'CORE_REQUEST');ok(!(await admin.rpc('mvp_decide_core',{p_actor:credentials[0].id,p_room:r.roomId,p_request:req.data,p_approve:true})).error,'New Core consent approves');
 ok(!!(await clients[2].rpc('mvp_join_member',{...join,p_actor:credentials[2].id})).error,'Browser cannot execute service-only join');
 const pause=await admin.rpc('mvp_deletion_is_paused');ok(!pause.error&&pause.data===true,'Deletion remains paused');
 for(const c of clients)await c.auth.signOut({scope:'local'});ok(true,'Synthetic clients signed out');r.complete=true;save();
 }catch(e){r.failure=/^[A-Z_]+$/.test(e.message)?e.message:'RELEASE_STAGING_FAILED';save();console.log(r.failure);process.exitCode=1}
})();
