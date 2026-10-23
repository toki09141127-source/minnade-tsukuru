/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit staging env only. No dotenv auto-load or production connection.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),dotenv=require('dotenv');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'../..'),env=dotenv.parse(fs.readFileSync(path.join(root,'.env.staging.local')));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/staging-project.json')));
const ctx=require('../staging/safety.cjs').validate(env,manifest);
if(ctx.ref!=='fwqucffxdmbdczspkcyr')throw Error('STAGING_IDENTITY_REJECTED');
function load(file){
 const m={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 module:m,exports:m.exports,fetch,Response,Request,AbortSignal,Date,URL,
 require:name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name)});
 return m.exports;
}
const client=createClient(ctx.url,env.SUPABASE_SERVICE_ROLE_KEY,{
 auth:{persistSession:false,autoRefreshToken:false},
 global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})},
});
const rpc=(name,args)=>client.rpc(name,args);
module.exports={root,env,ctx,client,rpc,load};
