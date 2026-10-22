/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/accountDeletionPreflight.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports});
const {planAccountDeletion}=mod.exports;
let n=0;const ok=(v,label)=>{assert.ok(v,label);console.log(++n+'. '+label)};
const base={complete:true,unpublishedCreatorRooms:0,ownedEvents:0,blockingForeignKeys:0,destructiveCascades:0,profileCleanupVerified:true,writeFenceVerified:true,triggersVerified:true,storageVerified:true,uploads:[]};
for(const key of ['unpublishedCreatorRooms','ownedEvents','blockingForeignKeys','destructiveCascades'])
 ok(planAccountDeletion({...base,[key]:1}).status==='needs_review','Blocks unresolved '+key);
for(const key of ['complete','profileCleanupVerified','writeFenceVerified','triggersVerified','storageVerified'])
 ok(planAccountDeletion({...base,[key]:false}).status==='needs_review','Unknown evidence blocks '+key);
const upload={id:'synthetic',published:false,shared:false,everUsed:false,expired:true,uploaded:true,storageOwnershipVerified:true};
for(const key of ['published','shared','everUsed'])
 ok(planAccountDeletion({...base,uploads:[{...upload,[key]:true}]}).uploads[0].action==='retain','Retains '+key+' upload even if expired');
for(const change of [{published:null},{everUsed:null},{storageOwnershipVerified:false},{uploaded:false}])
 ok(planAccountDeletion({...base,uploads:[{...upload,...change}]}).status==='needs_review','Unknown upload never deleted');
ok(planAccountDeletion({...base,uploads:[upload]}).uploads[0].action==='cleanup_candidate','Expired unused verified upload is candidate only');
ok(planAccountDeletion({...base,uploads:[{...upload,expired:false}]}).uploads[0].action==='retain','Unexpired unused upload retained');
ok(planAccountDeletion({...base,ownedEvents:-1}).status==='needs_review','Invalid counts fail closed');
ok(planAccountDeletion(base).status==='ready_for_verification','Complete plan does not certify prepared or invoke Auth');
console.log('Completed '+n+' deletion preflight checks; no external side effects.');
