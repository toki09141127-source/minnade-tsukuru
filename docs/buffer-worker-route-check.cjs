/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let count=0,calls=[];
const env={};
const load=file=>{
 const m={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  module:m,exports:m.exports,process:{env},Buffer,Response,Request,URL,AbortSignal,
  fetch:()=>{throw Error('NETWORK_FORBIDDEN')},
  require:name=>{
   if(name==='@supabase/supabase-js')return {createClient:()=>({rpc:async(name)=>{
    calls.push(name);assert.equal(name,'buffer_snapshot');
    return {data:{now:'2026-10-22T01:00Z',candidates:[],history:[],queue:[]},error:null};
   }})};
   return name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);
  },
 });
 return m.exports;
};
async function main(){
 const {GET}=load('app/api/cron/buffer/route.ts');
 const req=(auth='Bearer synthetic',query='')=>new Request('http://localhost/api/cron/buffer'+query,{headers:{authorization:auth}});
 const test=async(status,auth,query)=>{assert.equal((await GET(req(auth,query))).status,status);count++};
 await test(503);env.CRON_SECRET='synthetic';
 await test(401,'Bearer wrong');
 env.BUFFER_RUN_MODE='automatic';await test(503);
 env.BUFFER_RUN_MODE='canary';await test(503);
 env.BUFFER_CANARY_EVENT_ID='event';await test(503);
 env.BUFFER_RUN_MODE='invalid';await test(503);
 env.NEXT_PUBLIC_SUPABASE_URL='https://example.invalid';env.SUPABASE_SERVICE_ROLE_KEY='synthetic';
 env.BUFFER_RUN_MODE='automatic';
 const dry=await GET(req('Bearer synthetic','?dryRun=1'));assert.equal(dry.status,200);
 assert.deepEqual(await dry.json(),{mode:'dry-run',candidates:0,planned:0,queued:0,preSendEligible:0,writes:0,sends:0});count++;
 delete env.BUFFER_RUN_MODE;await test(200);
 assert.deepEqual(calls,['buffer_snapshot','buffer_snapshot']);count++;
 env.BUFFER_CRON_SECRET='dedicated';await test(401);await test(200,'Bearer dedicated');
 console.log('BUFFER_ROUTE_CHECKS '+count+' PASS; no network');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
