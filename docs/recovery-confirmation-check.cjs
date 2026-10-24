/* eslint-disable @typescript-eslint/no-require-imports -- Offline security boundaries for recovery link confirmation. */
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/emailConfirmation.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,URL,URLSearchParams});
const parse=mod.exports.recoveryConfirmationUrl,base='https://auth.example.invalid',site='https://staging.example.invalid';
const token='SYNTHETIC_PRIVATE_VALUE_1234567890123456';
const gate=site+'/auth/confirm#'+new URLSearchParams({recovery_token:token});
let checks=0;const valid=new URL(parse(gate,base));assert.equal(valid.origin,base);assert.equal(valid.pathname,'/auth/v1/verify');assert.equal(valid.searchParams.get('type'),'recovery');assert.equal(valid.searchParams.get('token'),token);assert.equal(valid.searchParams.get('redirect_to'),site+'/auth/callback?next=reset-password');checks++;
for(const [name,url,config] of [
 ['missing config',gate,undefined],
 ['config path',gate,base+'/wrong'],
 ['config http',gate,'http://auth.example.invalid'],
 ['config userinfo',gate,'https://user:password@auth.example.invalid'],
 ['config query',gate,base+'?extra=1'],
 ['config hash',gate,base+'#extra'],
 ['wrapper query',gate.replace('/auth/confirm#','/auth/confirm?other=1#'),base],
 ['wrapper extra fragment',gate+'&other=1',base],
 ['wrapper duplicate token',gate+'&recovery_token='+token,base],
 ['wrapper http',gate.replace('https:','http:'),base],
 ['wrapper userinfo',gate.replace('https://','https://user@'),base],
 ['wrapper wrong path',gate.replace('/auth/confirm#','/wrong#'),base],
 ['missing fragment',site+'/auth/confirm',base],
 ['empty token',site+'/auth/confirm#recovery_token=',base],
 ['short token',gate.replace(token,'short'),base],
 ['oversized token',gate.replace(token,'x'.repeat(1025)),base],
 ['script token',gate.replace(token,'javascript%3Aalert%281%29'),base],
 ['attempt auth override',gate+'&confirmation_url=https%3A%2F%2Fevil.invalid',base],
 ['attempt redirect override',gate+'&redirect_to=https%3A%2F%2Fevil.invalid',base],
 ['attempt type override',gate+'&type=signup',base],
 ]){assert.equal(parse(url,config),null,name);checks++;}
const parseBoth=mod.exports.emailConfirmationTarget;
for(const kind of ['signup','recovery']){
 const url=site+'/auth/confirm#'+new URLSearchParams({[kind+'_token']:token});
 const result=parseBoth(url,base);assert.equal(result.kind,kind);
 const destination=new URL(result.url);assert.equal(destination.origin,base);assert.equal(destination.searchParams.get('type'),kind);
 assert.equal(destination.searchParams.get('redirect_to'),site+'/auth/callback'+(kind==='recovery'?'?next=reset-password':''));checks++;
 for(const suffix of ['&signup_token='+token,'&recovery_token='+token,'&type=invite','&redirect_to=https://evil.invalid']){assert.equal(parseBoth(url+suffix,base),null);checks++;}
}
assert.equal(parseBoth(site+'/auth/confirm#invite_token='+token,base),null);checks++;
assert.equal(parse(site+'/auth/confirm#signup_token='+token,base),null);checks++;
console.log(JSON.stringify({scope:'offline signup/recovery URL boundaries',passed:checks}));
