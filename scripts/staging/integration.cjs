/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js'),{load}=require('./safety.cjs');
(async()=>{
 const c=load();
 if(c.manifest.emptyVerified!==true)throw Error('STAGING_EMPTY_VERIFICATION_REQUIRED');
 const dir=path.join(c.root,'.staging-private');
 if(!fs.existsSync(dir))throw Error('STAGING_PRIVATE_DIRECTORY_REQUIRED');
 const run=crypto.randomUUID(),result={runId:run,projectRef:c.ref,checks:[],users:[],bucket:null,objects:[],cleanup:'retained for review'};
 const privatePath=path.join(dir,run+'.json'),publicPath=path.join(c.root,'docs/staging-integration-result.json');
 const credentials=[];
 const historyDir=path.join(c.root,'docs/staging-runs');fs.mkdirSync(historyDir,{recursive:true});
 const save=()=>{fs.writeFileSync(privatePath,JSON.stringify({runId:run,projectRef:c.ref,credentials},null,2),{mode:0o600});fs.writeFileSync(publicPath,JSON.stringify(result,null,2));fs.writeFileSync(path.join(historyDir,run+'.json'),JSON.stringify(result,null,2));};
 const check=(condition,name)=>{assert.ok(condition,name);result.checks.push({name,status:'PASS'});save();console.log('PASS '+name)};
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(c.url,c.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const client=()=>createClient(c.url,c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
 try{
  for(const alias of ['creator-a','core-b','member-c','member-d','moderator-e','kicked-f']){
   const email=alias+'-'+run+'@example.invalid',password=crypto.randomBytes(32).toString('base64url');
   // Clearly synthetic accounts; no confirmation email sent.
   const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{synthetic:true,test_run:run}});
   if(error||!data.user)throw Error('STAGING_AUTH_SEED_FAILED');
   credentials.push({alias,id:data.user.id,email,password});result.users.push({alias,id:data.user.id});
   save();
  }
  check(credentials.length===6,'Six synthetic Auth accounts created (no application roles assigned)');
  const auth=client(),u=credentials[2];
  const login=await auth.auth.signInWithPassword({email:u.email,password:u.password});
  check(!login.error&&login.data.user?.id===u.id,'Password login');
  const second=client();const login2=await second.auth.signInWithPassword({email:u.email,password:u.password});
  check(!login2.error&&login2.data.user?.id===u.id,'Independent second session');
  const refreshed=await auth.auth.refreshSession();check(!refreshed.error&&!!refreshed.data.session,'Session refresh');
  const latestRefresh=refreshed.data.session.refresh_token;
  const out=await auth.auth.signOut({scope:'local'});check(!out.error,'Local session logout');
  const invalidRefresh=await client().auth.refreshSession({refresh_token:latestRefresh});
  check(!!invalidRefresh.error,'Logged-out refresh token rejected');
  const secondUser=await second.auth.getUser();check(!secondUser.error&&secondUser.data.user?.id===u.id,'Other session survives local logout');
  check(!!(await client().auth.getUser('invalid-synthetic-token')).error,'Invalid access token rejected');
  await second.auth.signOut();

  const disposable={email:'disposable-'+run+'@example.invalid',password:crypto.randomBytes(32).toString('base64url')};
  const created=await admin.auth.admin.createUser({...disposable,email_confirm:true,user_metadata:{synthetic:true,test_run:run}});
  if(created.error||!created.data.user)throw Error('STAGING_DISPOSABLE_AUTH_FAILED');
  result.disposableUser={id:created.data.user.id,deleted:false};save();
  const removed=await admin.auth.admin.deleteUser(created.data.user.id,false);
  check(!removed.error,'Disposable synthetic Auth user deleted without application data');
  result.disposableUser.deleted=true;save();
  check(!!(await client().auth.signInWithPassword(disposable)).error,'Deleted synthetic user cannot login');

  const bucket='synthetic-'+run;result.bucket=bucket;save();
  const made=await admin.storage.createBucket(bucket,{public:false,fileSizeLimit:4000000,allowedMimeTypes:['image/png']});
  if(made.error)throw Error('STAGING_BUCKET_CREATE_FAILED');
  const object='fixture/pixel.png',bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPrkAAAAASUVORK5CYII=','base64');
  const put=await admin.storage.from(bucket).upload(object,bytes,{contentType:'image/png',upsert:false});
  check(!put.error,'Synthetic private object uploaded');result.objects.push(object);save();
  const signed=await admin.storage.from(bucket).createSignedUrl(object,60);
  if(signed.error||!signed.data?.signedUrl)throw Error('STAGING_SIGN_FAILED');
  const signedUrl=new URL(signed.data.signedUrl);if(signedUrl.origin!==c.url)throw Error('STAGING_SIGN_ORIGIN_REJECTED');
  const response=await fetch(signedUrl,{redirect:'error',signal:AbortSignal.timeout(10000)});
  const returned=Buffer.from(await response.arrayBuffer());
  check(response.ok&&returned.equals(bytes),'Signed URL retrieves exact synthetic bytes');
  const anon=client();
  check(!!(await anon.storage.from(bucket).download(object)).error,'Anonymous private download denied');
  check(!!(await anon.storage.from(bucket).createSignedUrl(object,60)).error,'Anonymous signing denied');
  check(!!(await anon.storage.from(bucket).upload('fixture/forbidden.png',bytes,{contentType:'image/png'})).error,'Anonymous upload denied');
  const large=await admin.storage.from(bucket).upload('fixture/too-large.png',Buffer.alloc(4000001),{contentType:'image/png'});
  check(!!large.error,'Storage bucket size limit enforced');
  const mime=await admin.storage.from(bucket).upload('fixture/wrong.txt',Buffer.from('synthetic'),{contentType:'text/plain'});
  check(!!mime.error,'Storage bucket MIME allowlist enforced');
  console.log('Completed '+result.checks.length+' staging service checks. App schema/RLS/withdrawal integration not tested. Synthetic fixtures retained.');
 }finally{save()}
})().catch(()=>{console.error('STAGING_INTEGRATION_FAILED: inspect sanitized result; no secret diagnostics emitted.');process.exitCode=1});
