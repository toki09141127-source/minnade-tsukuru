/* eslint-disable @typescript-eslint/no-require-imports */
const {load}=require('./safety.cjs');
(async()=>{
 const c=load();
 for(const [name,path,key] of [
  ['auth-health','/auth/v1/health',c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
  ['rest-schema','/rest/v1/',c.env.SUPABASE_SERVICE_ROLE_KEY]]){
  const headers={apikey:key};
  if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
  const r=await fetch(c.url+path,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});
  await r.body?.cancel();
  if(!r.ok)throw Error('STAGING_SERVICE_CHECK_FAILED');
  console.log('PASS '+name);
 }
 console.log('Read-only connectivity only. Auth login/Storage/migrations/product flows NOT verified.');
})().catch(e=>{console.error(/^STAGING_|^PRODUCTION_|^KEY_/.test(e.message)?e.message:'STAGING_SMOKE_FAILED');process.exitCode=1});
