/* eslint-disable @typescript-eslint/no-require-imports */
// Exact synthetic identities in a two-hour production maintenance window.
const x=require('./free-release-context.cjs'),crypto=require('crypto'),{createClient}=require('@supabase/supabase-js');
module.exports=async mode=>{
 x.assert.equal(process.argv[3],x.REF);
 const f=x.privateRead('v2-free-fixture.aes');x.assert.equal(f.projectRef,x.REF);x.assert.ok(Date.parse(f.expiresAt)>Date.now(),'TEST_WINDOW_EXPIRED');
 const env=x.env(),opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,opts),clients=[],tokens=[];
 const db=await x.connect(),file='v2-free-'+mode+'-result.json',out=x.fs.existsSync('docs/'+file)?x.read(file):{at:new Date().toISOString(),projectRef:x.REF,runId:f.runId,checks:[],complete:false};
 x.assert.equal(out.runId,f.runId);out.complete=false;delete out.failure;delete out.lastHttp;
 const save=()=>{x.privateSave('v2-free-fixture.aes',f);x.save(file,out)};
 const ok=name=>{if(!out.checks.some(v=>v.name===name))out.checks.push({name,pass:true});save();console.log('PASS '+name)};
 const step=async(name,fn)=>{if(out.checks.some(v=>v.name===name))return;out.phase=name;save();await fn();ok(name)};
 try{
 for(const u of f.users){x.assert.match(u.email,new RegExp('^v2free-[a-z]+-'+f.runId+'@example\\.invalid$'));const existing=await admin.auth.admin.getUserById(u.id);if(existing.error?.status===404&&mode==='smoke'){const r=await admin.auth.admin.createUser({id:u.id,email:u.email,password:u.password,email_confirm:true,user_metadata:{synthetic:true,release_test:f.runId}});x.assert.ok(!r.error,'SYNTHETIC_CREATE_FAILED');x.assert.equal(r.data.user.id,u.id)}else if(existing.error)throw Error('TEST_AUTH_UNAVAILABLE');
 const c=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts),r=await c.auth.signInWithPassword({email:u.email,password:u.password});x.assert.ok(!r.error,'SYNTHETIC_LOGIN_FAILED');clients.push(c);tokens.push(r.data.session.access_token);
 if(mode==='smoke'){const consent=await c.rpc('mvp_accept_current_terms',{p_terms:'2026-10-24',p_privacy:'2026-10-24',p_adult:true});x.assert.ok(!consent.error,'CURRENT_CONSENT_FAILED')}
 }
 const call=async(i,route,body,method)=>{const headers={...(i!=null?{authorization:'Bearer '+tokens[i]}:{}),Origin:x.BASE};if(body&&!(body instanceof FormData))headers['content-type']='application/json';const r=await fetch(x.BASE+route,{method:method||(body?'POST':'GET'),headers,body:body?body instanceof FormData?body:JSON.stringify(body):undefined,signal:AbortSignal.timeout(40000),redirect:'error'});const data=await r.json().catch(()=>null);return {status:r.status,data}};
 const expect=(r,status=200)=>{if(r.status!==status){out.lastHttp={status:r.status,expected:status,code:/^[A-Z_]+$/.test(r.data?.code||'')?r.data.code:undefined};save()}x.assert.equal(r.status,status,'HTTP_STATUS')};
 const denied=r=>x.assert.ok(r.status>=400&&r.status<500,'AUTHORIZATION_DENIAL');
 const id=key=>f.ids[key]||(f.ids[key]=crypto.randomUUID());
 const feature=async(name,value)=>{const request=crypto.randomUUID();await db.query('INSERT INTO mvp_release_stop.test_objects VALUES($1) ON CONFLICT DO NOTHING',[request]);const s=await call(3,'/api/admin?section=system');expect(s);const r=await call(3,'/api/admin',{confirm:true,request,action:'feature',type:'system',target:name,version:s.data.detail.version,value,reason:'operational',note:'TEST Free V2 release verification'});expect(r);x.assert.ok(!r.data.error,'FEATURE_FAILED')};
 const close=async()=>{for(const c of clients)await c.auth.signOut().catch(()=>{});await db.query('ROLLBACK').catch(()=>{});await db.end()};
 return {...x,crypto,admin,clients,tokens,db,f,out,save,ok,step,call,expect,denied,id,feature,close};
 }catch(e){for(const c of clients)await c.auth.signOut().catch(()=>{});await db.end();throw e}
};
