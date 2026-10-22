/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js'),{load}=require('./safety.cjs');
(async()=>{
 const c=load(),run=crypto.randomUUID(),r={runId:run,projectRef:c.ref,checks:[],users:[],rooms:[],scope:'Core RPC staging; synthetic only'},creds=[];
 const admin=createClient(c.url,c.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const save=()=>{fs.writeFileSync(path.join(c.root,'.staging-private',run+'.json'),JSON.stringify({runId:run,projectRef:c.ref,credentials:creds}));fs.writeFileSync(path.join(c.root,'docs/staging-runs',run+'.json'),JSON.stringify(r,null,2));fs.writeFileSync(path.join(c.root,'docs/core-staging-result.json'),JSON.stringify(r,null,2));};
 const ok=(v,name)=>{assert.ok(v,name);r.checks.push({name,status:'PASS'});save();console.log('PASS '+name);};
 const rpc=async(name,args)=>{const x=await admin.rpc(name,args);if(x.error){r.failure={operation:name,code:x.error.code};throw Error('RPC_FAILED');}return x.data;};
 try{
  for(let i=0;i<8;i++){
   const email='core-'+i+'-'+run+'@example.invalid',password=crypto.randomBytes(32).toString('base64url');
   const x=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{synthetic:true,test_run:run}});
   if(x.error)throw Error('AUTH_SEED');creds.push({id:x.data.user.id,email,password});r.users.push({id:x.data.user.id,alias:'core-'+i});save();
  }
  const [owner,...users]=creds.map(x=>x.id);
  const settings={title:'SYNTHETIC CORE RACE',category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'};
  const makeRoom=async()=>{const room=await rpc('mvp_create_room',{p_actor:owner,p_request:crypto.randomUUID(),p_settings:settings});r.rooms.push(room);save();for(const id of users)await rpc('mvp_join_member',{p_actor:id,p_room:room,p_terms:'2026-03-24'});return room;};
  const request=(room,user)=>rpc('mvp_request_core',{p_actor:user,p_room:room,p_terms:'2026-03-24'});
  const args=(room,id)=>({p_actor:owner,p_room:room,p_request:id,p_approve:true});
  const room=await makeRoom();
  for(const u of users.slice(0,3))await rpc('mvp_decide_core',args(room,await request(room,u)));
  const reqA=await request(room,users[3]),reqB=await request(room,users[4]);
  const results=await Promise.all([reqA,reqB].map(id=>admin.rpc('mvp_decide_core',args(room,id))));
  const cores=await admin.from('room_members').select('user_id').eq('room_id',room).eq('role','core').is('left_at',null);
  ok(results.filter(x=>!x.error).length===1&&results.filter(x=>x.error?.message==='CORE_FULL').length===1&&cores.data?.length===4,'Last Core slot: exactly one winner and four active Cores');
  const requests=await admin.from('room_join_requests').select('status,user_id').in('id',[reqA,reqB]);
  ok(requests.data?.filter(x=>x.status==='approved').length===1&&requests.data?.filter(x=>x.status==='pending').length===1,'Losing approval leaves request pending, no partial decision');
  const winner=results[0].error?reqB:reqA;
  const duplicate=await Promise.all([1,2].map(()=>admin.rpc('mvp_decide_core',args(room,winner))));
  ok(duplicate.every(x=>!x.error&&x.data.replayed===true),'Concurrent repeated approval safely replays');
  const room2=await makeRoom(),pending=await request(room2,users[0]);
  const leave=await Promise.all([admin.rpc('mvp_decide_core',args(room2,pending)),admin.from('room_members').update({left_at:new Date().toISOString()}).eq('room_id',room2).eq('user_id',users[0])]);
  if(leave[1].error){const again=await admin.from('room_members').update({left_at:new Date().toISOString()}).eq('room_id',room2).eq('user_id',users[0]);if(again.error)throw Error('LEAVE_RETRY_FAILED');}
  const left=await admin.from('room_members').select('role,left_at').eq('room_id',room2).eq('user_id',users[0]).single();
  ok(left.data?.left_at!==null,'Concurrent leave leaves no active Core and never revives departed membership');
  r.raceSemantics='Operations serialize at DB locks. A promotion already committed before leave may remain in audit; final membership is inactive. Deadlock victims must retry.';
  const kickReq=await request(room2,users[1]);
  const kickArgs={p_actor:owner,p_room:room2,p_target:users[1],p_action:'kick'};
  const kick=await Promise.all([admin.rpc('mvp_decide_core',args(room2,kickReq)),admin.rpc('mvp_manage_member',kickArgs)]);
  if(kick[1].error)await rpc('mvp_manage_member',kickArgs);
  const rejoin=await admin.rpc('mvp_join_member',{p_actor:users[1],p_room:room2,p_terms:'2026-03-24'});
  const kicked=await admin.from('room_members').select('left_at').eq('room_id',room2).eq('user_id',users[1]).single();
  ok(!!rejoin.error&&kicked.data?.left_at!==null,'Concurrent kick leaves target inactive and rejoin forbidden');
  const duplicated=await Promise.all([1,2].map(()=>admin.rpc('mvp_request_core',{p_actor:users[2],p_room:room2,p_terms:'2026-03-24'})));
  ok(duplicated.every(x=>!x.error)&&duplicated[0].data===duplicated[1].data,'Concurrent Core requests converge on one pending row');
  const id=duplicated[0].data;
  const mismatch=await admin.rpc('mvp_decide_core',{...args(room2,id),p_actor:users[3]});
  ok(mismatch.error?.message==='NOT_CREATOR','Non-Creator direct privileged call is rejected');
  const wrongRoom=await admin.rpc('mvp_decide_core',args(room,id));
  ok(wrongRoom.error?.message==='REQUEST_NOT_FOUND','Cross-room approval rejected');
  const noConsent=await admin.rpc('mvp_request_core',{p_actor:users[4],p_room:room2,p_terms:'wrong'});
  ok(!!noConsent.error,'Wrong consent version rejected');
  const old=await admin.rpc('approve_core_request',{p_room_id:room2,p_creator_user_id:owner,p_request_id:id});
  ok(!!old.error,'Old Core approval RPC is revoked even for service client');
  const anon=createClient(c.url,c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  ok(!!(await anon.rpc('mvp_decide_core',args(room2,id))).error,'Anon new Core approval RPC denied');
  const login=await anon.auth.signInWithPassword({email:creds[1].email,password:creds[1].password});if(login.error)throw Error('LOGIN_FAILED');
  ok(!!(await anon.rpc('mvp_decide_core',args(room2,id))).error,'Authenticated direct Core approval RPC denied');
  await anon.auth.signOut({scope:'local'});
  r.complete=true;save();
 }catch{r.complete=false;r.failure=r.failure||{operation:'core integration',code:'CHECK_FAILED'};save();console.error('CORE_STAGING_CHECK_FAILED');process.exitCode=1;}
})().catch(()=>{console.error('CORE_STAGING_SETUP_FAILED');process.exitCode=1;});
