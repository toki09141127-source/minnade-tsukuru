/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js'),{load}=require('./safety.cjs');
(async()=>{
 const c=load(),f=JSON.parse(fs.readFileSync(path.join(c.root,'docs/core-staging-result.json'))),privateF=JSON.parse(fs.readFileSync(path.join(c.root,'.staging-private',f.runId+'.json')));
 const user=privateF.credentials[0],other=privateF.credentials[1],opts={auth:{persistSession:false,autoRefreshToken:false}};
 const auth=createClient(c.url,c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts),anon=createClient(c.url,c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts);
 const r={projectRef:c.ref,checks:[]},ok=(v,name)=>{assert.ok(v,name);r.checks.push({name,status:'PASS'})};
 try{
  const login=await auth.auth.signInWithPassword({email:user.email,password:user.password});ok(!login.error,'Synthetic authenticated session');
  const own=await auth.from('profiles').select('id,username,terms_version');ok(!own.error&&own.data.length===1&&own.data[0].id===user.id,'Own profile only over real REST');
  const forbidden=await auth.from('profiles').select('username').eq('id',other.id);ok(!forbidden.error&&forbidden.data.length===0,'Wrong-user profile yields no rows');
  ok(!!(await anon.from('profiles').select('username')).error,'Anon private profile denied');
  ok(!!(await auth.from('profiles').select('deleted_at')).error,'Internal profile column denied');
  ok(!!(await auth.from('profiles').update({bio:'must not save'}).eq('id',user.id)).error,'Direct profile mutation denied');
  const members=await auth.from('room_members').select('user_id,role,last_seen_at');ok(!members.error&&members.data.length>0&&members.data.every(x=>x.user_id===user.id),'Own memberships only');
  ok(!!(await anon.from('room_members').select('user_id')).error,'Anon membership enumeration denied');
  ok(!!(await auth.from('room_members').update({role:'creator'}).eq('user_id',other.id)).error,'REST role escalation denied');
  ok(!!(await auth.from('room_members').update({last_seen_at:new Date().toISOString()}).eq('user_id',user.id)).error,'No general UPDATE for last_seen');
  const list=await anon.from('mvp_room_list').select('id,title,member_count').eq('id',f.rooms[0]);ok(!list.error&&list.data.length===1&&list.data[0].member_count>=1,'Anonymous safe listing and counts work');
  ok(!!(await anon.from('mvp_room_list').select('host_ids')).error,'Internal list column absent');
  ok(!!(await anon.from('rooms_with_counts_v2').select('id')).error,'Old broad view denied');
  ok(!!(await anon.from('rooms').select('core_invite_code')).error,'Invite secret denied');
  const publicP=await anon.from('public_profiles').select('username,bio');ok(!publicP.error,'Public profile projection works');
  ok(!!(await anon.from('public_profiles').select('id')).error,'Public profile internal id denied');
  ok(!!(await auth.rpc('mvp_accept_current_terms',{p_terms:'wrong',p_privacy:'2026-03-24'})).error,'Wrong consent version denied');
  ok(!(await auth.rpc('mvp_accept_current_terms',{p_terms:'2026-03-24',p_privacy:'2026-03-24'})).error,'Current consent saved through self RPC');
  r.complete=true;
 }catch(e){r.failure={code:e.code||e.name};process.exitCode=1;}
 finally{fs.writeFileSync(path.join(c.root,'docs/client-read-staging-result.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2));}
})();

