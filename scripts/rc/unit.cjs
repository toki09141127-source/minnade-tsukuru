/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require("fs"),vm=require("vm"),ts=require("typescript"),assert=require("node:assert/strict");
let env={},checks=0;
function configured(){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/ai/provider.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,process:{env},require:()=>({}),fetch:()=>{throw Error("NETWORK_FORBIDDEN")}});return m.exports.aiConfigured()}
env={AI_ENABLED:"true",AI_PROVIDER:"synthetic",STAGING_TEST:"true"};
assert.equal(configured(),true);checks++;
env.VERCEL="1";assert.equal(configured(),false);checks++;
Object.assign(env,{VERCEL_ENV:"preview",V2_RC_SYNTHETIC_AI:"true",NEXT_PUBLIC_SUPABASE_URL:"https://fwqucffxdmbdczspkcyr.supabase.co"});
assert.equal(configured(),true);checks++;
for(const [key,value] of [["VERCEL_ENV","production"],["V2_RC_SYNTHETIC_AI","false"],["STAGING_TEST","false"],["NEXT_PUBLIC_SUPABASE_URL","https://joedeuyrzimqyjapqpyh.supabase.co"],["AI_ENABLED","false"]]){
 const old=env[key];env[key]=value;assert.equal(configured(),false);checks++;env[key]=old;
}
console.log(JSON.stringify({scope:"RC synthetic provider boundary",complete:true,checks,network:0}));
