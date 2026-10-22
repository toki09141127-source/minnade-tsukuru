/* eslint-disable @typescript-eslint/no-require-imports -- Isolated offline route regression. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = process.env.BUFFER_TEST_REPO || path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const code = ts.transpileModule(fs.readFileSync(path.join(root, 'app/api/integrations/buffer/check/route.ts'), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
}).outputText;
const good = {id:'6ad9a93b778b240e2f8816f0',name:'minnade_tsukuru',service:'twitter',isDisconnected:false,isLocked:false,isQueuePaused:false};
let passed = 0;
async function check(options, status, expectedCode) {
  let calls = 0;
  const module = {exports:{}};
  vm.runInNewContext(code, {
    module, exports:module.exports, Buffer, Response, AbortSignal,
    process:{env:options.env || {CRON_SECRET:'synthetic-cron',BUFFER_API_KEY:'synthetic-key'}},
    require:name=>{assert.equal(name,'node:crypto'); return crypto;},
    fetch:async (url, init)=>{
      calls++;
      assert.equal(url,'https://api.buffer.com');
      assert.equal(init.redirect,'error');
      assert.equal(init.cache,'no-store');
      assert.equal(init.headers.Authorization,'Bearer synthetic-key');
      assert.equal(init.signal.aborted,false);
      assert.match(JSON.parse(init.body).query,/^query BufferConnectionCheck/);
      assert.doesNotMatch(init.body,/mutation|createPost/);
      if(options.throws) throw new Error('synthetic-key private upstream failure');
      if(options.badJson) return new Response('private synthetic-key',{status:200});
      return Response.json(options.payload ?? {data:{channel:{...good,...options.channel}}},{status:options.upstreamStatus || 200});
    },
  });
  const headers = options.noAuth ? {} : {Authorization:options.auth || 'Bearer synthetic-cron'};
  const response = await module.exports.POST(new Request('https://example.invalid/api/integrations/buffer/check',{method:'POST',headers}));
  assert.equal(response.status,status);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const text = await response.text();
  assert.doesNotMatch(text,/synthetic-key|synthetic-cron|private/);
  assert.equal(JSON.parse(text).code,expectedCode);
  assert.equal(JSON.parse(text).ok,status===200);
  assert.equal(calls,options.noFetch ? 0:1);
  passed++;
}
(async()=>{
  await check({},200,'BUFFER_CONNECTED');
  await check({channel:{name:'@MINNADE_TSUKURU'}},200,'BUFFER_CONNECTED');
  await check({env:{},noFetch:true},503,'CHECK_NOT_CONFIGURED');
  await check({noAuth:true,noFetch:true},401,'UNAUTHORIZED');
  await check({auth:'Bearer synthetic-wrong',noFetch:true},401,'UNAUTHORIZED');
  await check({auth:'Bearer synthetic-croo',noFetch:true},401,'UNAUTHORIZED');
  await check({env:{CRON_SECRET:'synthetic-cron'},noFetch:true},503,'BUFFER_NOT_CONFIGURED');
  for(const upstreamStatus of [401,403]) await check({upstreamStatus},502,'BUFFER_ACCESS_DENIED');
  await check({upstreamStatus:429},503,'BUFFER_RATE_LIMITED');
  for(const upstreamStatus of [302,500]) await check({upstreamStatus},502,'BUFFER_UNAVAILABLE');
  await check({throws:true},502,'BUFFER_CHECK_FAILED');
  await check({badJson:true},502,'BUFFER_CHECK_FAILED');
  await check({payload:{errors:[{message:'synthetic-key private'}],data:{channel:good}}},502,'BUFFER_QUERY_FAILED');
  await check({payload:{errors:{message:'private'}}},502,'BUFFER_QUERY_FAILED');
  await check({payload:{data:{channel:null}}},502,'BUFFER_CHANNEL_MISMATCH');
  for(const channel of [{id:'wrong'},{name:'wrong'},{service:'instagram'}]) await check({channel},502,'BUFFER_CHANNEL_MISMATCH');
  for(const channel of [{isDisconnected:true},{isLocked:true},{isLocked:null}]) await check({channel},503,'BUFFER_CHANNEL_UNAVAILABLE');
  await check({channel:{isQueuePaused:true}},503,'BUFFER_QUEUE_PAUSED');
  await check({channel:{isQueuePaused:null}},503,'BUFFER_QUEUE_PAUSED');
  console.log('Buffer connection check: '+passed+' offline cases passed (no real credentials or network)');
})().catch(()=>{console.error('Buffer connection regression failed');process.exitCode=1;});

