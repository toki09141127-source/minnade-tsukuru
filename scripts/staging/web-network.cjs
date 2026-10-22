/* eslint-disable @typescript-eslint/no-require-imports */
const stage='fwqucffxdmbdczspkcyr.supabase.co';
if(process.env.STAGING_TEST!=='true'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://'+stage)throw Error('STAGING_WEB_TARGET_REJECTED');
const allowed=h=>[stage,'127.0.0.1','localhost','::1'].includes(h);
const check=u=>{if(!allowed(new URL(u).hostname))throw Error('STAGING_WEB_NETWORK_REJECTED');};
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,...args)=>{check(typeof input==='string'||input instanceof URL?input:input.url);return originalFetch(input,...args)};
for(const name of ['node:http','node:https']){
 const transport=require(name);
 for(const method of ['request','get']){
  const original=transport[method];
  transport[method]=function(input,...args){
   if(typeof input==='string'||input instanceof URL)check(input);
   else if(!allowed(input.hostname||input.host))throw Error('STAGING_WEB_NETWORK_REJECTED');
   return original.call(this,input,...args);
  };
 }
}
const tls=require('node:tls'),connect=tls.connect;
tls.connect=function(...args){
 const options=args.find(x=>x&&typeof x==='object');
 if(!options||!allowed(options.servername||options.host))throw Error('STAGING_TLS_TARGET_REJECTED');
 return connect.apply(this,args);
};
