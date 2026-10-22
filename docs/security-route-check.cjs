/* eslint-disable @typescript-eslint/no-require-imports -- Node harness loads transpiled route modules in an isolated VM. */
const fs = require('node:fs');
const vm = require('node:vm');
const pathUtil = require('node:path');
const assert = require('node:assert/strict');
const root = pathUtil.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
let total = 0;
function fixture(options = {}) {
  const room = { id: 'room-a', status: 'forced_publish', deleted_at: null, is_hidden: false, ...options.room };
  const post = { id: 'post-a', room_id: 'room-a', attachment_url: 'rooms/room-a/images/a.png', deleted_at: null, is_hidden: false, ...options.post };
  const member = { id: 'member-a', room_id: 'room-a', user_id: 'user-a', role: 'core', left_at: null, ...options.member };
  const calls = { signs: [], inserts: [], queries: [], uploads: [], rpcs: [] };
  const rows = { attachment_uploads: [], rooms: options.noRoom ? [] : [room], posts: options.noPost ? [] : [post], room_members: options.noMember ? [] : [member], public_profiles: [{id:'user-a',username:'tester'}], post_attachments: [{post_id:'post-a',storage_path:'rooms/private/images/secret.png'}] };
  const admin = {
    auth: { getUser: async () => ({data:{user:options.badToken ? null : {id:'user-a'}},error:null}) },
    rpc: async (name,args) => { calls.rpcs.push({name,args}); return { data: name==='mvp_take_rate_limit' ? options.rateAllowed!==false : name==='mvp_public_post_allowed'?true:'post-created', error: options.rpcError ? {message:options.rpcError} : null }; },
    from(table) {
      let filters = [], update;
      const query = {
        select() { calls.queries.push(table); return this; },
        eq(key, value) { filters.push(row => row[key] === value); return this; },
        is(key, value) { filters.push(row => (row[key] ?? null) === value); return this; },
        order() { return this; },
        update(value) { update=value; return this; },
        async maybeSingle() { const row=rows[table].find(row=>filters.every(f=>f(row))); if(row && update) Object.assign(row,update); return {data: row ?? null,error:null}; },
        async insert(value) { calls.inserts.push(value); rows[table].push(value); return {error:null}; },
      };
      return query;
    },
    storage: { from: () => ({ upload: async (path) => {calls.uploads.push(path);return {error:null};}, createSignedUrl: async (path, ttl) => {calls.signs.push({path,ttl}); return {data:{signedUrl:'https://example.invalid/signed'},error:null};} }) },
  };
  return {admin,calls};
}
async function run(route, options, body, expected, note, token = true) {
  if(route==='uploads'&&options.ledger===undefined) options={...options,ledger:true};
  const f = fixture(options);
  const mocks = {
    'next/server': {NextResponse:{json:(data,init)=>Response.json(data,init),redirect:(url,init)=>new Response(null,{...init,headers:{location:url}})}},
    '@supabase/supabase-js': {createClient:()=>f.admin},
  };
  function load(file) {
  const loadedModule = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{exports:loadedModule.exports,module:loadedModule,require:name=> {
    if(mocks[name]) return mocks[name];
    if(name.endsWith('/imagePrivacy')) return {sanitizeImage:async(bytes)=>bytes};
    if(name.endsWith('lib/supabase/admin')) return {supabaseAdmin:f.admin};
    if(name.startsWith('.')) return load(pathUtil.resolve(pathUtil.dirname(file),name)+'.ts');
    throw new Error('Unexpected dependency: '+name);
  }, process:{env:{MVP_UPLOADS_ENABLED:options.uploads===false?'false':'true',MVP_DRAFTS_ENABLED:options.drafts===false?'false':'true',MVP_DB_GUARDS_ENABLED: options.ledger ? 'true' : undefined}}, console, Response, Request, Buffer, Uint8Array, TextDecoder, crypto:require('node:crypto').webcrypto});
  return loadedModule.exports;
  }
  const api=load(`${root}/app/api/${route}/route.ts`);
  const req = new Request('https://example.invalid/api',{method:'POST',headers:token?{authorization:'Bearer fake-test-token'}:{},body:JSON.stringify(body)});
  if(route==='uploads')req.formData=async()=>new Map([['roomId','room-a'],['file',{type:'image/png',name:'test.png',size:8,arrayBuffer:async()=>Uint8Array.from([137,80,78,71,13,10,26,10]).buffer}]]);
  const response = route.includes('[postId]') ? await api.GET(req,{params:Promise.resolve({postId:'post-a'})}) : await api.POST(req);
  assert.equal(response.status,expected,note);
  if(expected>=400) {assert.equal(f.calls.signs.length,0,note);assert.equal(f.calls.inserts.length,0,note);assert.equal(f.calls.uploads.length,0,note);}
  if(expected<400 && (route.includes('sign') || route.includes('[postId]'))) {
    assert.equal(f.calls.signs.length,1,note);
    assert.equal(f.calls.signs[0].ttl,300,note);
  }
  if(expected===200 && route==='posts/create') assert.equal(options.ledger ? f.calls.rpcs.filter(c=>c.name==='create_post_with_upload').length : f.calls.inserts.length,1,note);
  if(expected===200 && route==='uploads') assert.equal(f.calls.uploads.length,1,note);
  total++;
  console.log(`${total}. ${note}: HTTP ${response.status}`);
  return f;
}
(async()=>{
  await run('storage/sign',{}, {postId:'post-a'},200,'Public visible post allowed anonymously',false);
  await run('storage/sign',{}, {path:'rooms/private/a.png'},400,'Old arbitrary path input rejected',false);
  for(const post of [{is_hidden:true},{is_hidden:null},{deleted_at:'deleted'},{attachment_url:null}])
    await run('storage/sign',{post},{postId:'post-a'},404,'Public invalid post rejected '+JSON.stringify(post),false);
  for(const room of [{status:'open'},{status:'closed'},{is_hidden:true},{is_hidden:null},{deleted_at:'deleted'}])
    await run('storage/sign',{room},{postId:'post-a'},404,'Public invalid room rejected '+JSON.stringify(room),false);
  await run('storage/sign',{noPost:true},{postId:'post-a'},404,'Missing post denied',false);
  await run('storage/sign',{noRoom:true},{postId:'post-a'},404,'Missing room denied',false);
  await run('uploads/sign',{}, {postId:'post-a'},200,'Active member allowed');
  await run('uploads/sign',{}, {postId:'post-a'},401,'No token denied',false);
  await run('uploads/sign',{badToken:true}, {postId:'post-a'},401,'Invalid token denied');
  await run('uploads/sign',{noMember:true}, {postId:'post-a'},403,'Nonmember denied');
  await run('uploads/sign',{member:{left_at:'left'}}, {postId:'post-a'},403,'Former member denied');
  for(const post of [{is_hidden:true},{deleted_at:'deleted'}])
    await run('uploads/sign',{post},{postId:'post-a'},404,'Member hidden/deleted post denied');
  const body={roomId:'room-a',content:'test'};
  await run('posts/create',{room:{status:'open'}},body,503,'Text post stops when DB guards are disabled');
  for(const path of ['rooms/room-b/images/x.png','https://example.invalid/a.png','rooms/room-a//x.png','rooms/room-a/../x.png','rooms/room-a/./x.png','rooms/room-a/images\\x.png','rooms/room-a/'])
    await run('posts/create',{room:{status:'open'}},{...body,attachment_url:path},400,'Invalid attachment rejected '+path);
  await run('posts/create',{room:{status:'open'}},{...body,attachment_url:null},503,'Text-only also stops with DB guards OFF');
  await run('posts/create',{room:{status:'open'},member:{left_at:'left'}},body,403,'Former member cannot post');
  await run('posts/create',{room:{status:'open'},member:{role:'supporter'}},{...body,post_type:'final'},403,'Supporter cannot submit final');
  await run('posts/create',{room:{status:'open'}},{...body,post_type:'final'},503,'Final submission stops with DB guards OFF');
  await run('posts/create',{},body,403,'Published room cannot accept posts');
  console.log('--- Regression checks for additional fixes ---');
  for(const room of [{is_hidden:true},{deleted_at:'deleted'}]) {
    await run('uploads/sign',{room},{postId:'post-a'},404,'Unavailable room signing denied');
    await run('posts/create',{room:{status:'open',...room}},body,404,'Unavailable room posting denied');
    await run('uploads',{room:{status:'open',...room}},{},404,'Unavailable room upload denied');
  }
  await run('storage/sign',{post:{attachment_url:'rooms/room-b/images/private.png'}},{postId:'post-a'},404,'Legacy cross-room public signing denied');
  await run('uploads/sign',{post:{attachment_url:'rooms/room-b/images/private.png'}},{postId:'post-a'},404,'Legacy cross-room member signing denied');
  await run('posts/create',{room:{status:'open'}},{...body,attachment_url:'rooms/room-a/images/another-user.png'},400,'FIXED: legacy same-room path is not ownership evidence');
  await run('uploads/public/[postId]',{room:{status:'open'},post:{is_hidden:true}}, {},404,'Alternate public endpoint denies hidden post',false);
  await run('uploads/public/[postId]',{room:{status:'open'}}, {},404,'Alternate public endpoint denies unpublished room',false);
  await run('uploads/public/[postId]',{}, {},302,'Alternate public endpoint redirects visible published attachment',false);
  await run('uploads',{room:{status:'open'},ledger:false},{},503,'Upload fails closed until ledger enabled');
  for(const attachment_url of ['rooms/room-a/%2e%2e/private.png','rooms/room-a/images/a.png?x','rooms/room-a/images/a.png#x']) {
    await run('posts/create',{room:{status:'open'}},{...body,attachment_url},400,'Ambiguous path denied on create');
    await run('storage/sign',{post:{attachment_url}},{postId:'post-a'},404,'Ambiguous path denied on sign');
  }
  for (const route of ['uploads','posts/create']) {
    const payload = route === 'uploads' ? {} : body;
    await run(route,{room:{status:'open'}},payload,401,'No login denied: '+route,false);
    await run(route,{room:{status:'open'},noMember:true},payload,403,'Nonmember denied: '+route);
    await run(route,{room:{status:'open'},member:{left_at:'left'}},payload,403,'Former member denied: '+route);
  }
  const linked = await run('uploads',{room:{status:'open'},ledger:true},{},200,'Enabled ledger reserves and confirms upload');
  assert.equal(linked.calls.inserts[0].user_id,'user-a');
  assert.equal(linked.calls.inserts[0].status,'uploaded');
  const posted=await run('posts/create',{room:{status:'open'},ledger:true},{...body,uploadId:'55555555-5555-4555-8555-555555555555',requestId:'66666666-6666-4666-8666-666666666666',userId:'spoofed'},200,'Post uses atomic RPC');
  assert.equal(posted.calls.rpcs.find(c=>c.name==='create_post_with_upload').args.p_actor,'user-a');
  await run('posts/create',{room:{status:'open'},ledger:true,rateAllowed:false},body,429,'Shared rate limit rejects posts');
  await run('uploads',{room:{status:'open'},ledger:true,rateAllowed:false},{},429,'Shared rate limit rejects uploads');
  await run('posts/create',{room:{status:'open'},ledger:true,rpcError:'internal fixture'},body,503,'DB guard failure fails closed');
  await run('posts/create',{room:{status:'open'}},{...body,content:'x'.repeat(20001)},413,'Long text rejected');  await run('posts/create',{room:{status:'open',expires_at:'2000-01-01'}},{roomId:'room-a',content:'fixture'},403,'Expired room refuses posts before cron');
  await run('uploads',{room:{status:'open'},ledger:true,uploads:false},{},503,'Upload-only switch blocks valid upload');
  await run('storage/sign',{drafts:false},{postId:'post-a'},503,'Draft switch prevents public signing');
  await run('uploads/public/[postId]',{drafts:false},{},503,'Alternate public signature also stops');
  console.log(`Completed ${total} assertions; fake database/storage only; no external requests or real mutations.`);

})().catch(e=>{console.error(e);process.exitCode=1;});
