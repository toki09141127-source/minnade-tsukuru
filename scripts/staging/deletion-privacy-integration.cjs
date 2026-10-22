/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js'),{load}=require('./safety.cjs');
(async()=>{
 const c=load(),run=crypto.randomUUID(),r={runId:run,projectRef:c.ref,checks:[],blockers:[],scope:'Synthetic privacy preconditions, NOT completed Auth deletion'},creds=[];
 const admin=createClient(c.url,c.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const save=()=>{fs.writeFileSync(path.join(c.root,'.staging-private',run+'.json'),JSON.stringify({runId:run,projectRef:c.ref,credentials:creds}));fs.writeFileSync(path.join(c.root,'docs/deletion-privacy-staging-result.json'),JSON.stringify(r,null,2));};
 const ok=(v,name)=>{assert.ok(v,name);r.checks.push({name,status:'PASS'});save();console.log('PASS '+name)};
 const rpc=async(name,args)=>{const x=await admin.rpc(name,args);if(x.error)throw Error(name+':'+x.error.code);return x.data;};
 try{
  for(let i=0;i<2;i++){
   const email='privacy-'+i+'-'+run+'@example.invalid',password=crypto.randomBytes(32).toString('base64url');
   const x=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{synthetic:true,test_run:run}});
   if(x.error)throw Error('AUTH_SEED');creds.push({id:x.data.user.id,email,password});save();
  }
  const [owner,member]=creds.map(x=>x.id);
  const settings={title:'SYNTHETIC PRIVACY',category:'その他',work_type:'novel',is_adult:false,time_limit_hours:24,enable_core_approval:true,enable_core_invite:false,ai_level:'assist'};
  const room=await rpc('mvp_create_room',{p_actor:owner,p_request:crypto.randomUUID(),p_settings:settings});r.room=room;
  const args=id=>({p_actor:id,p_attribution:'anonymous',p_policy:'withdrawal-draft-2026-10-21'});
  const denied=await admin.rpc('mvp_request_deletion',args(owner));
  ok(denied.error?.message==='UNPUBLISHED_CREATOR_ROOMS','Unpublished Creator request rejected');
  const jobs=await admin.from('account_deletion_jobs').select('id').eq('actor_id',owner);
  ok(!jobs.error&&jobs.data.length===0,'Rejected request creates no deletion job');
  await rpc('mvp_join_member',{p_actor:member,p_room:room,p_terms:'2026-03-24'});
  const p=await admin.from('profiles').update({bio:'SYNTHETIC BIO',website_url:'SYNTHETIC LINK'}).eq('id',member);if(p.error)throw Error('PROFILE_SEED');
  const profile=await admin.from('profiles').select('username').eq('id',member).single();if(profile.error)throw Error('PROFILE_READ');
  const pub=await admin.from('public_profiles').upsert({id:member,username:profile.data.username,bio:'SYNTHETIC BIO',avatar_url:'SYNTHETIC AVATAR',links:{synthetic:'value'}});if(pub.error)throw Error('PUBLIC_SEED');
  const post=await admin.from('posts').insert({room_id:room,user_id:member,content:'SYNTHETIC RETAIN'}).select('id').single();if(post.error)throw Error('POST_SEED');r.post=post.data.id;
  // Test Web prerequisites before withdrawal; absence of grants is a blocker, never a PASS.
  const client=createClient(c.url,c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await client.auth.signInWithPassword({email:creds[1].email,password:creds[1].password});if(signed.error)throw Error('TEST_LOGIN');
  for(const table of ['profiles','room_members','mvp_room_list']){
   const x=await client.from(table).select(table==='profiles'?'id':table==='room_members'?'id':'id').limit(1);
   if(x.error)r.blockers.push({flow:'Web read '+table,code:x.error.code});
  }
  const job=await rpc('mvp_request_deletion',args(member));
  ok(await rpc('mvp_request_deletion',args(member))===job,'Withdrawal retry returns same job');
  const clean=await admin.from('profiles').select('bio,website_url,deleted_at').eq('id',member).single();
  const cleanPub=await admin.from('public_profiles').select('bio,avatar_url,links').eq('id',member).single();
  ok(!clean.error&&!cleanPub.error&&clean.data.bio===null&&clean.data.website_url===null&&!!clean.data.deleted_at&&Object.values(cleanPub.data).every(v=>v===null),'Profile PII cleared in real staging');
  const retained=await admin.from('posts').select('content').eq('id',post.data.id).single();
  ok(!retained.error&&retained.data.content==='SYNTHETIC RETAIN','Joint post retained');
  const blocked=await admin.from('profiles').update({bio:'SHOULD FAIL'}).eq('id',member);
  ok(blocked.error?.message==='ACCOUNT_WITHDRAWAL_PENDING','Profile write fence maintained');
  const still=await admin.auth.admin.getUserById(member);
  ok(!still.error&&still.data.user.id===member,'Auth retained until full preparation verified');
  r.complete=true;r.accountDeletionComplete=false;save();
 }catch(e){r.failure={code:e.message};save();console.error('PRIVACY_ACCEPTANCE_FAILED');process.exitCode=1;}
})();

