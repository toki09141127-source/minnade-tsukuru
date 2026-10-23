/* eslint-disable @typescript-eslint/no-require-imports -- Offline VM with no network or secrets. */
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path'), assert=require('node:assert/strict');
const root=process.env.BUFFER_TEST_REPO || path.resolve(__dirname,'..');
const ts=require(path.join(root,'node_modules/typescript'));
function load(file) {
 const loadedModule={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module:loadedModule,exports:loadedModule.exports,require:name=>{
  assert.equal(name,'../publicationSafety');return load(path.join(root,'lib/publicationSafety.ts'));
 }});
 return loadedModule.exports;
}
const {planPromotions:plan}=load(path.join(root,'lib/buffer/promotionPlanner.ts'));
const now='2026-10-22T01:00:00Z'; // 10:00 JST
const candidate=(id,extra={})=>({id,kind:'completed',targetId:id,createdAt:'2026-10-22T00:00:00Z',
 expiresAt:'2026-10-23T12:00:00Z',snapshotAt:now,public:true,hidden:false,deleted:false,
 pendingReport:false,creatorExcluded:false,reviewed:true,piiClear:true,title:'共同制作の作品',...extra});
const history=(extra={})=>({eventId:'old',contentKey:'completed:old',kind:'completed',dueAt:'2026-10-22T03:00:00Z',state:'sent',...extra});
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('single uses evening',()=>assert.equal(plan([candidate('a')],[],now)[0].dueAt,'2026-10-22T11:30:00.000Z'));
test('priority and daily cap',()=>{
 const p=plan([candidate('n',{kind:'new_room',seatsAvailable:1,deadlineAt:'2026-10-24T00:00:00Z'}),candidate('b'),candidate('a')],[],now);
 assert.equal(p.length,2);assert.equal(p[0].eventId,'a');assert.equal(p[1].eventId,'b');assert.equal(p[0].dueAt,'2026-10-22T03:00:00.000Z');
});
for(const [field,value] of Object.entries({public:false,hidden:true,deleted:true,pendingReport:true,creatorExcluded:true,reviewed:false,piiClear:false})) {
 test(field+' blocks',()=>assert.equal(plan([candidate('a',{[field]:value})],[],now).length,0));
 test(field+' missing blocks',()=>assert.equal(plan([candidate('a',{[field]:undefined})],[],now).length,0));
}
for(const title of ['test@example.com','090-1234-5678','@someone','https://evil.invalid','line\nline','abc\u202edef']) {
 test('unsafe text blocked',()=>assert.equal(plan([candidate('a',{title})],[],now).length,0));
}
test('stale snapshot blocked',()=>assert.equal(plan([candidate('a',{snapshotAt:'2026-10-22T00:54:59Z'})],[],now).length,0));
test('future snapshot blocked',()=>assert.equal(plan([candidate('a',{snapshotAt:'2026-10-22T01:00:01Z'})],[],now).length,0));
test('invalid date blocked',()=>assert.equal(plan([candidate('a',{expiresAt:'bad'})],[],now).length,0));
test('ambiguous timezone blocked',()=>assert.equal(plan([candidate('a',{snapshotAt:'2026-10-22T01:00:00'})],[],now).length,0));
test('expired event blocked',()=>assert.equal(plan([candidate('a',{expiresAt:'2026-10-22T11:30:00Z'})],[],now).length,0));
for(const state of ['sent','reserved','uncertain']) {
 test(state+' excludes retries',()=>assert.equal(plan([candidate('a')],[history({eventId:'a',state,dueAt:'2026-10-21T03:00:00Z'})],now).length,0));
 test(state+' consumes cap',()=>assert.equal(plan([candidate('a')],[history({state}),history({state,eventId:'old2',dueAt:'2026-10-22T11:30:00Z'})],now).length,0));
}
test('same target deduplication',()=>assert.equal(plan([candidate('a'),candidate('b',{targetId:'a'})],[],now).length,1));
test('persisted target deduplication',()=>assert.equal(plan([candidate('a')],[history({contentKey:'completed:a'})],now).length,0));
test('cancelled not counted',()=>assert.equal(plan([candidate('a')],[history({eventId:'a',state:'cancelled'})],now).length,1));
test('one new room per day',()=>{
 const n=id=>candidate(id,{kind:'new_room',seatsAvailable:1,deadlineAt:'2026-10-24T00:00:00Z'});
 assert.equal(plan([n('a'),n('b')],[],now).length,1);
 assert.equal(plan([n('a')],[history({kind:'new_room'})],now).length,0);
});
test('full recruitment excluded',()=>assert.equal(plan([candidate('a',{kind:'new_room',seatsAvailable:0,deadlineAt:'2026-10-24T00:00:00Z'})],[],now).length,0));
test('deadline within 24 hours eligible',()=>assert.equal(plan([candidate('a',{kind:'deadline',seatsAvailable:1,deadlineAt:'2026-10-23T01:00:00Z'})],[],now).length,1));
test('deadline far away excluded',()=>assert.equal(plan([candidate('a',{kind:'deadline',seatsAvailable:1,deadlineAt:'2026-10-24T01:00:00Z'})],[],now).length,0));
test('deadline before send excluded',()=>assert.equal(plan([candidate('a',{kind:'deadline',seatsAvailable:1,deadlineAt:'2026-10-22T05:00:00Z'})],[],now).length,0));
test('JST date boundary',()=>{
 const at='2026-10-21T15:01:00Z';
 const p=plan([candidate('a',{createdAt:at,snapshotAt:at})],[history({dueAt:'2026-10-21T14:59:00Z'})],at);
 assert.equal(p[0].dueAt,'2026-10-22T11:30:00.000Z');
});
test('no past slots',()=>{
 const at='2026-10-22T12:00:00Z';
 assert.equal(plan([candidate('a',{snapshotAt:at})],[],at).length,0);
});
test('weekly sunday only',()=>{
 const w=candidate('week',{kind:'weekly',weeklyCounts:{rooms:2,works:1,participants:3}});
 assert.equal(plan([w],[],now).length,0);
 const at='2026-10-25T01:00:00Z';
 assert.equal(plan([{...w,createdAt:at,snapshotAt:at,expiresAt:'2026-10-26T00:00:00Z'}],[],at).length,1);
});
test('invalid now fails closed',()=>assert.throws(()=>plan([],[],'bad'),/INVALID_NOW/));
test('invalid history fails closed',()=>assert.throws(()=>plan([],[history({dueAt:'bad'})],now),/INVALID_HISTORY/));
test('official links and immutable input',()=>{
 const input=[candidate('a',{title:'あ'.repeat(200)})];const before=JSON.stringify(input);
 const p=plan(input,[],now);assert.equal(JSON.stringify(input),before);
 assert.match(p[0].text,/https:\/\/minnade-tsukuru.vercel.app\/works\/a/);
 assert.ok(p[0].text.length<200);
});
console.log(count+' offline planner cases passed; no network, DB or publishing.');
