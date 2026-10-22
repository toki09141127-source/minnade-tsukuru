/* eslint-disable @typescript-eslint/no-require-imports -- Isolated route audit with fake DB only. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('../node_modules/typescript');
const root = path.resolve(__dirname, '..');
let cases = 0;
function fixture(options = {}) {
  const calls = [];
  const user = options.anonymous ? null : { id: 'actor', user_metadata: {} };
  const rows = {
    rooms: [{ id: 'room', status: 'open', expires_at:null, created_by: 'actor', is_hidden: false,
      deleted_at: null, enable_core_approval: true, ...options.room }],
    room_members: options.member === null ? [] : [{ id: 'membership', room_id: 'room',
      user_id: 'actor', role: 'core', is_core: true, joined_at: '2020-01-01',
      left_at: null, last_seen_at:null, ...options.member }],
    profiles: [{ id: 'actor', username: 'fixture' }],
    room_likes: [], reports: [],
    room_join_requests: [{ id: 'request', room_id: 'room', user_id: 'target',
      status: 'pending', requested_role: 'core', room_terms_version: 'fixture',
      room_agreed_at: '2026-01-01', forced_publish_ack_at: '2026-01-01', core_lock_agreed_at: '2026-01-01' }],
    posts: [{ id: 'post', room_id: 'room', user_id: 'actor', deleted_at: null, is_hidden:false, created_at:'2020-01-01', is_marked: false, marked_by:null, marked_at:null, ...options.post }],
  };
  const admin = {
    auth: { getUser: async () => ({ data: { user }, error: null }), admin: { deleteUser: async (id) => { calls.push({operation:'authDelete',id}); return {error:options.authDeleteError?{message:'PRIVATE_DB_DIAGNOSTIC'}:null}; } } },
    storage: { listBuckets: async () => { calls.push({ operation: 'listBuckets' }); return { data: [], error: null }; } },
    rpc: async (name,args) => { calls.push({ operation: 'rpc',name,args }); return { data: name === 'mvp_deletion_is_paused' ? !!options.paused : name === 'mvp_join_member' ? options.rpcData ?? 'supporter' : name === 'mvp_create_room' ? '33333333-3333-4333-8333-333333333333' : name === 'mvp_set_room_like' ? true : name === 'mvp_take_rate_limit' ? !options.rateDenied : name === 'mvp_request_deletion' ? 'request-fixture' : name === 'mvp_pending_reports' ? {items:Array.from({length:51},(_,i)=>({id:String(i),created_at:'2026-10-01T00:00:00Z'})),total:51,overdue:51} : name === 'mvp_receive_report' ? [{receipt_id:'receipt',processing_state:options.reportState??'pending'}] : {}, error: options.deletionError && name==='mvp_request_deletion' ? {message:options.deletionError} : options.rpcError && name!=='mvp_take_rate_limit' ? {message:options.rpcError} : options.dbError&&name==='mvp_publish_due'?{message:'PRIVATE'}:null }; },
    from(table) {
      if (!rows[table]) throw new Error('Unexpected table');
      let operation = 'select', payload, filters = [], head = false;
      const query = {
        select(columns, opts) {
          if (operation === 'select' && columns !== '*' && rows[table].length) {
            for (const column of columns.split(',').map(c=>c.trim())) {
              if (!(column in rows[table][0])) throw new Error('Unknown fixture column '+table+'.'+column);
            }
          }
          head = !!opts?.head; return this;
        },
        in(k,values) { filters.push(row=>values.includes(row[k])); return this; },
        gt(k,v) { filters.push(row=>row[k]>v); return this; },
        neq(k,v) { filters.push(row=>row[k]!==v); return this; },
        eq(k,v) { filters.push(row => row[k] === v); return this; },
        is(k,v) { filters.push(row => (row[k] ?? null) === v); return this; },
        lte(k,v) { filters.push(row => row[k] != null && row[k] <= v); return this; },
        not(k,op,v) { assert.equal(op,'is'); assert.equal(v,null); filters.push(row => row[k] != null); return this; },
        upsert(v) { operation = 'upsert'; payload = v; return this; },
        insert(v) { operation = 'insert'; payload = v; return this; },
        update(v) { operation = 'update'; payload = v; return this; },
        delete() { operation = 'delete'; return this; },
        async finish(single) {
          calls.push({ table, operation, payload });
          if (options.dbError) return { data:null,error:{message:'fixture internal details'} }; 
          if (operation==='update' && table==='posts' && options.beforePostUpdate) options.beforePostUpdate(rows.posts);
          const affected = rows[table].filter(r=>filters.every(f=>f(r)));
          if (operation !== 'select') {
            if (operation === 'upsert') {
              let row = rows[table].find(r => r.room_id === payload.room_id && r.user_id === payload.user_id);
              if (row) Object.assign(row,payload); else rows[table].push({...payload});
            }
            if (operation === 'insert') rows[table].push({...payload});
            if (operation === 'update') rows[table].filter(r=>filters.every(f=>f(r))).forEach(r=>Object.assign(r,payload));
            return { data: single ? affected[0] ?? null : affected, error: null };
          }
          const found = rows[table].filter(r => filters.every(f=>f(r)));
          return { data: head ? null : single ? found[0] ?? null : found, count: options.count ?? found.length, error: null };
        },
        maybeSingle() { return this.finish(true); },
        single() { return this.finish(true); },
        then(resolve,reject) { return this.finish(false).then(resolve,reject); },
      };
      return query;
    },
  };
  function load(relative) {
    const filename = path.resolve(root,relative);
    const mod = { exports: {} };
    const compiled = ts.transpileModule(fs.readFileSync(filename,'utf8'),{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
    }).outputText;
    vm.runInNewContext(compiled,{
      exports:mod.exports,module:mod, Request,Response,URL,Date,console,
      process:{env:{MVP_DRAFTS_ENABLED:options.drafts===false?'false':'true',MVP_MEMBERSHIP_GUARDS_ENABLED:options.membership===false?'false':'true',MVP_UPLOADS_ENABLED:options.uploads===false?'false':'true',MVP_ACCOUNT_FINALIZE_ENABLED:options.finalize?'true':'false',MVP_ATOMIC_CORE_ENABLED:options.coreDisabled?'false':'true',MVP_ATOMIC_JOIN_ENABLED:options.atomicJoin===false?'false':'true',MVP_MODERATION_ENABLED:options.moderation?'true':'false',MVP_ROOM_CREATION_ENABLED:options.roomCreation?'true':'false',MVP_LIKE_REQUESTS_ENABLED:options.likeRequests?'true':'false',MVP_REPORT_QUEUE_ENABLED:options.reportQueue?'true':'false',MVP_REPORT_INTAKE_ENABLED:options.reportIntake?'true':'false',NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',CRON_SECRET:options.noSecret ? '' : 'fixture-secret',MVP_DB_GUARDS_ENABLED:options.guards===false ? 'false' : 'true',MVP_ACCOUNT_REQUESTS_ENABLED:options.accountRequests ? 'true' : 'false'}},
      require(name) {
        if (name === '@/lib/accountDeletion' && options.workerState) return {resumeAccountDeletion:async id=>{calls.push({operation:'worker',id});return options.workerState}};
        if (name === 'next/server') return { NextResponse:{json:(body,init)=>Response.json(body,init)} };
        if (options.noServices) throw new Error('Retired endpoint imported a dependency: '+name);
        if (name === '@supabase/supabase-js') return { createClient:()=>admin };
        if (/lib\/supabase\/admin$/.test(name)) return {supabaseAdmin:admin,createAdminClient:()=>admin};
        if (/lib\/supabase\/server$/.test(name)) return {createAdminClient:()=>admin,createUserClient:async()=>admin};
        if (name.startsWith('.')) return load(path.resolve(path.dirname(filename),name)+'.ts');
        if (name.startsWith('@/lib/')) return load(name.slice(2)+'.ts');
        throw new Error('Unexpected dependency: '+name);
      },
      fetch:()=>{throw new Error('Network forbidden');},
    });
    return mod.exports;
  }
  async function call(file, body = {}, token = true, method = 'POST') {
    const request = new Request('https://example.invalid/test',{method,
      headers:token?{authorization:'Bearer fixture-token'}:{},
      ...(method==='POST'?{body:JSON.stringify(body)}:{})});
    return load(file)[method](request,{params:Promise.resolve({id:'room'})});
  }
  return { calls,rows,call,load };
}
function ok(condition, label) { assert.ok(condition,label); cases++; console.log(cases+'. '+label); }
(async()=>{
  const joinBody={roomId:'room',consent:{roomTermsVersion:'2026-03-24',roomAgreedAt:'ack',forcedPublishAckAt:'ack'}};
  for(const [options,status] of [[{rpcData:'core'},200],[{rpcData:'creator'},200],[{rpcError:'MEMBER_FULL'},409],[{rpcError:'MEMBER_EXCLUDED'},403],[{rpcData:'unexpected'},503],[{anonymous:true},401]]) {
    const j=fixture({atomicJoin:true,...options});
    const response=await j.call('app/api/rooms/join-supporter/route.ts',joinBody);
    ok(response.status===status&&!j.calls.some(c=>c.operation==='upsert'),'Atomic join has no legacy write fallback: '+status);
  }
  let f=fixture({anonymous:true});
  let res=await f.call('app/api/rooms/expire/route.ts',{},false);
  ok(res.status===410 && f.calls.length===0,'FIXED: retired expire has no DB access');
  f=fixture({anonymous:true});
  res=await f.call('app/api/debug/buckets/route.ts',{},false,'GET');
  ok(res.status===410 && f.calls.length===0,'FIXED: retired debug has no Storage access');
  for (const file of ['app/api/rooms/join/route.ts']) {
    f=fixture({count:100});
    res=await f.call(file,{roomId:'room'});
    ok(res.status===410 && f.rows.room_members[0].role==='core' && f.calls.length===0,'FIXED: retired join cannot bypass consent/capacity or demote core: '+file);
    ok(f.rows.room_members[0].is_core===true,'FIXED: retired join preserves is_core: '+file);
    f=fixture({anonymous:true});
    res=await f.call(file,{roomId:'room'},false);
    ok(res.status===410 && f.calls.length===0,'Retired join denies unauthenticated caller: '+file);
  }
  f=fixture();
  res=await f.call('app/api/rooms/join/route.ts',{roomId:'room'});
  res=await f.call('app/api/rooms/leave/route.ts',{roomId:'room'});
  ok(res.status===403 && f.rows.room_members[0].left_at===null,'FIXED: retired join cannot bypass aged-core leave lock');
  f=fixture();
  res=await f.call('app/api/rooms/leave/route.ts',{roomId:'room'});
  ok(res.status===403,'Control: aged core leave alone denied');
  f=fixture({rpcError:'ROOM_UNAVAILABLE',member:null,room:{is_hidden:true,deleted_at:'2020-01-01'},count:0});
  res=await f.call('app/api/rooms/join-supporter/route.ts',{roomId:'room',consent:{
    roomTermsVersion:'fixture',roomAgreedAt:'2026-01-01',forcedPublishAckAt:'2026-01-01'}});
  ok(res.status===403 && !f.calls.some(c=>c.operation==='upsert'),'FIXED: current supporter join rejects hidden/deleted room');
  f=fixture({member:null});
  res=await f.call('app/api/rooms/join-supporter/route.ts',{roomId:'room'});
  ok(res.status===400 && !f.calls.some(c=>c.operation==='upsert'),'Control: current supporter join requires consent');
  f=fixture({member:null,count:0,room:{is_hidden:true}});
  res=await f.call('app/api/rooms/expire/join/route.ts',{roomId:'room'});
  ok(res.status===410 && f.calls.length===0,'FIXED: legacy expire/join has no DB access');
  f=fixture({member:null,count:100});
  res=await f.call('app/rooms/[id]/core-approve/route.ts',{requestId:'request'});
  ok(res.status===410 && f.calls.length===0,'FIXED: retired creator approval cannot insert core');
  f=fixture({room:{created_by:'another-user'}});
  res=await f.call('app/rooms/[id]/core-approve/route.ts',{requestId:'request'});
  ok(res.status===410 && f.calls.length===0,'Retired approval denies noncreator without DB access');
  f=fixture({member:{left_at:'2020-01-01'}});
  res=await f.call('app/api/posts/delete/route.ts',{postId:'post'});
  ok(res.status===403 && !f.calls.some(c=>c.table==='posts'&&c.operation==='update'),'FIXED: former member cannot delete own post');
  f=fixture({anonymous:true});
  res=await f.call('app/api/cron/publish/route.ts',{},false,'GET');
  ok(res.status===401 && !f.calls.some(c=>c.operation==='update'),'Control: cron denies missing secret');
  for (const [file,method] of [
    ['app/api/rooms/expire/route.ts','POST'],['app/api/debug/buckets/route.ts','GET'],
    ['app/rooms/join/route.ts','POST'],['app/api/rooms/expire/join/route.ts','POST']]) {
    for (const token of [true,false]) {
      f=fixture({anonymous:!token}); res=await f.call(file,{roomId:'room'},token,method);
      ok(res.status===410 && f.calls.length===0 && res.headers.get('cache-control')==='no-store',
        'Retired endpoint never reaches service: '+file+' token='+token);
    }
  }
  for(const route of ['join-core-first-come','join-core-by-invite']){
    f=fixture();res=await f.call('app/api/rooms/'+route+'/route.ts',{roomId:'room'});
    ok(res.status===410&&f.calls.length===0,'Old privileged Core entry is retired: '+route);
  }
  for(const route of ['approve-core','reject-core']){
    f=fixture({coreDisabled:true});res=await f.call('app/api/rooms/'+route+'/route.ts',{roomId:'room',requestId:'request'});
    ok(res.status===503&&f.calls.filter(c=>c.operation==='rpc').every(c=>c.name==='mvp_take_rate_limit'),'Disabled atomic Core route has no legacy fallback: '+route);
  }
  const consent={roomTermsVersion:'fixture',roomAgreedAt:'2026-01-01',
    forcedPublishAckAt:'2026-01-01',coreLockAgreedAt:'2026-01-01'};
  for (const file of ['app/api/rooms/join-supporter/route.ts','app/api/rooms/request-core/route.ts']) {
    for (const room of [{is_hidden:true},{deleted_at:'2026-01-01'},{is_hidden:null}]) {
      f=fixture({member:null,count:0,room,...(file.includes('join-supporter')?{rpcError:'ROOM_UNAVAILABLE'}:{})});res=await f.call(file,{roomId:'room',consent});
      ok(res.status===(file.includes('join-supporter')?403:404) && !f.calls.some(c=>['insert','upsert'].includes(c.operation)),
        'Hidden/deleted/unknown visibility denies '+file+' '+JSON.stringify(room));
    }
    const core=file.includes('request-core');
    f=fixture({member:core?{role:'supporter'}:null,count:0});res=await f.call(file,{roomId:'room',consent});
    ok(res.status===200 && f.calls.some(c=>core?c.name==='mvp_request_core':c.name==='mvp_join_member'),
      'Visible open room accepts valid Member join/request: '+file);
    f=fixture({member:null,count:0,room:{status:'published'},...(!core?{rpcError:'ROOM_UNAVAILABLE'}:{})});res=await f.call(file,{roomId:'room',consent});
    ok(res.status===(core?400:403) && !f.calls.some(c=>['insert','upsert'].includes(c.operation)),
      'Closed room denies join/request: '+file);
    f=fixture({anonymous:true});res=await f.call(file,{roomId:'room',consent},false);
    ok(res.status===401 && f.calls.length===0,'No bearer denies join/request: '+file);
  }
  f=fixture({member:null,count:45,rpcError:'MEMBER_FULL'});res=await f.call('app/api/rooms/join-supporter/route.ts',{roomId:'room',consent});
  ok(res.status===409 && !f.calls.some(c=>c.operation==='upsert'),'Supporter capacity still enforced for sequential requests');
  f=fixture();res=await f.call('app/api/rooms/join-supporter/route.ts',{roomId:'room',consent});
  ok(res.status===200 && f.rows.room_members[0].role==='core' && !f.calls.some(c=>c.operation==='upsert'),
    'Current supporter route preserves existing active core');
  f=fixture();res=await f.call('app/api/posts/delete/route.ts',{postId:'post'});
  ok(res.status===200 && f.calls.some(c=>c.table==='posts'&&c.operation==='update'),'Active owner can still delete own post');
  f=fixture({member:null});res=await f.call('app/api/posts/delete/route.ts',{postId:'post'});
  ok(res.status===403 && !f.calls.some(c=>c.operation==='update'),'Nonmember cannot delete own post');
  f=fixture();f.rows.posts[0].user_id='another';res=await f.call('app/api/posts/delete/route.ts',{postId:'post'});
  ok(res.status===403 && !f.calls.some(c=>c.operation==='update'),'Active member cannot delete another owner post');
  f=fixture({anonymous:true});
  res=await f.load('app/api/cron/publish/route.ts').GET(new Request('https://example.invalid/api/cron/publish',
    {headers:{authorization:'Bearer fixture-secret'}}));
  ok(res.status===200 && f.calls.some(c=>c.name==='mvp_publish_due'),
    'FIXED: documented Vercel cron Authorization header is accepted');
  for (const route of ['app/api/rooms/join/route.ts',...['core-request','core-approve','core-reject','core-revoke'].map(p=>'app/rooms/[id]/'+p+'/route.ts')]) {
    for (const scenario of [{member:{role:'creator'}},{member:{role:'supporter'}},{member:{left_at:'left'}},{anonymous:true},{member:null}]) {
      f=fixture({...scenario,noServices:true,count:100});
      const before=JSON.stringify(f.rows);
      res=await f.load(route).POST(new Request('https://example.invalid/test',{
        method:'POST',headers:{authorization:'Bearer invalid-fixture',cookie:'fixture=session'},body:'not-json'
      }),{params:Promise.resolve({id:'room'})});
      ok(res.status===410 && res.headers.get('cache-control')==='no-store' && f.calls.length===0 && JSON.stringify(f.rows)===before,
        'Retired route has no service dependency or side effect: '+route+' '+JSON.stringify(scenario));
    }
  }
  for (const route of ['approve-core','reject-core']) {
    const file='app/api/rooms/'+route+'/route.ts';
    f=fixture({anonymous:true}); res=await f.call(file,{roomId:'room',requestId:'request'},false);
    ok(res.status===401 && f.calls.length===0,'Current '+route+' still denies missing bearer');
    f=fixture(); res=await f.call(file,{roomId:'room',requestId:'request',userId:'spoofed'});
    ok(res.status===200 && f.calls.some(c=>c.operation==='rpc' && c.name==='mvp_decide_core' && c.args.p_actor==='actor' && c.args.p_room==='room' && c.args.p_request==='request' && !('p_room_id' in c.args) && !('p_request_id' in c.args)),
      'Current '+route+' keeps verified actor and request payload');
    f=fixture({rpcError:'NOT_CREATOR'}); res=await f.call(file,{roomId:'room',requestId:'request'});
    ok(res.status===403 && !f.calls.some(c=>c.operation==='update'),'Current '+route+' preserves RPC authorization failure');
  }
  f=fixture(); res=await f.call('app/api/rooms/approve-core/route.ts',{roomId:'another-room',requestId:'request'});
  ok([403,404].includes(res.status) && f.calls.filter(c=>c.operation==='rpc').every(c=>c.name==='mvp_take_rate_limit'),'Current approval rejects cross-room request before RPC');

  // SQL deadline/visibility/idempotence behavior is covered by baseline and staging integration.
  for (const scenario of [{},{noSecret:true},{dbError:true}]) {
    f=fixture(scenario);
    res=await f.load('app/api/cron/publish/route.ts').GET(new Request('https://example.invalid/cron?key=fixture-secret', {headers:scenario.dbError?{authorization:'Bearer fixture-secret'}:{}}));
    ok(res.status===(scenario.noSecret||scenario.dbError?503:401),'Cron fails closed for missing header/secret/DB failure');
    ok(!(await res.text()).includes('fixture internal'),'Cron error hides internal details');
  }
  for (const name of ['join-supporter','request-core','approve-core','reject-core','create']) {
    f=fixture({guards:true,rateDenied:true});
    res=await f.call('app/api/rooms/'+name+'/route.ts',{roomId:'room',requestId:'request',title:'fixture',inviteCode:'ABCDEF',consent:{...consent,coreLockAgreedAt:'2026-01-01'}});
    ok(res.status===429 && f.calls.filter(c=>c.operation==='rpc').every(c=>c.name==='mvp_take_rate_limit') && !f.calls.some(c=>['insert','upsert','update'].includes(c.operation)), 'Rate limit blocks mutations: '+name);
  }
  f=fixture({guards:true,rateDenied:true});res=await f.call('app/api/reports/create/route.ts',{targetType:'post',targetId:'post',reason:'fixture'});
  ok(res.status===429 && f.rows.reports.length===0,'Report spam limited');
  f=fixture();res=await f.call('app/api/reports/create/route.ts',{targetType:'post',targetId:'post',reason:'x'.repeat(2001)});
  ok(res.status===400 && f.rows.reports.length===0,'Report length bounded');


  for(const isApi of [true,false]) {
    f=fixture();
    f.rows.rooms.push({id:'room-b',is_hidden:false,deleted_at:null});
    f.rows.room_members.push({id:'m-b',room_id:'room-b',user_id:'actor',role:'core',left_at:null,last_seen_at:'2025-01-01'});
    f.rows.posts[0].user_id='other';
    f.rows.posts.push({id:'p-b',room_id:'room-b',user_id:'other',created_at:'2020-01-01',is_hidden:false,deleted_at:null});
    const read=async()=>isApi?(await (await f.call('app/api/rooms/unread-map/route.ts',{},true,'GET')).json()).map:await f.load('lib/rooms/getUnreadMapForUser.ts').getUnreadMapForUser();
    let map=await read();
    ok(map.room===1 && map['room-b']===0,'Unread preserves never-seen room alongside seen room: '+isApi);
    f.rows.posts[0].is_hidden=true;map=await read();ok(map.room===0,'Unread ignores hidden post: '+isApi);
    f.rows.posts[0].is_hidden=false;f.rows.posts[0].deleted_at='2021-01-01';map=await read();ok(map.room===0,'Unread ignores deleted post: '+isApi);
    f.rows.posts[0].deleted_at=null;f.rows.rooms[0].is_hidden=true;map=await read();ok(!('room' in map),'Unread omits hidden room: '+isApi);
    f.rows.rooms[0].is_hidden=false;f.rows.rooms[0].deleted_at='2021-01-01';map=await read();ok(!('room' in map),'Unread omits deleted room: '+isApi);
    f.rows.rooms[0].deleted_at=null;f.rows.room_members[0].left_at='2021-01-01';map=await read();ok(!('room' in map),'Unread omits former membership: '+isApi);
  }


  const markFile='app/api/posts/toggle-mark/route.ts';
  for(const [scenario,status] of [
    [{anonymous:true},401],[{member:null},403],[{member:{role:'supporter'}},403],
    [{member:{left_at:'left'}},403],[{room:{is_hidden:true}},404],[{room:{is_hidden:null}},404],
    [{room:{deleted_at:'deleted'}},404],[{room:{status:'forced_publish'}},403],[{room:{expires_at:'2000-01-01'}},403],[{post:{is_hidden:true}},404],[{post:{is_hidden:null}},404],
    [{post:{deleted_at:'deleted'}},404],[{post:{room_id:'other'}},400],[{dbError:true},503],
    [{},200],[{member:{role:'creator'}},200]
  ]) {
    f=fixture(scenario);res=await f.call(markFile,{roomId:'room',postId:'post'},!scenario.anonymous);
    ok(res.status===status && (status===200 ? f.calls.some(c=>c.name==='mvp_highlight') : !f.calls.some(c=>c.operation==='update')),'Mark visibility and role: '+JSON.stringify(scenario));
  }
  f=fixture({rpcError:'STATE_CHANGED'});res=await f.call(markFile,{roomId:'room',postId:'post'});
  ok(res.status===409&&!f.calls.some(c=>c.operation==='update'),'Atomic highlight conflict has no direct write fallback');

  for (const scenario of [{anonymous:true},{},{dbError:true},{authDeleteError:true},{member:{role:'creator'}}]) {
    f=fixture(scenario);
    const before=JSON.stringify(f.rows);
    for(let retry=0;retry<2;retry++) {
      res=await f.call('app/api/account/delete/route.ts',{userId:'spoofed'},!scenario.anonymous);
      const body=await res.json();
      ok(res.status===(scenario.anonymous?401:503) && body.ok===false &&
        res.headers.get('cache-control')==='no-store' &&
        (scenario.anonymous || body.code==='ACCOUNT_DELETION_UNAVAILABLE') &&
        f.calls.length===0 && JSON.stringify(f.rows)===before,
        'Withdrawal suspended without DB/Auth mutations, including retry: '+JSON.stringify(scenario)+' '+retry);
    }
  }
  f=fixture({anonymous:true});res=await f.call('app/api/account/delete/route.ts',{},true);
  ok(res.status===401 && f.calls.length===0,'Invalid bearer cannot start withdrawal');
  const deletionSource=fs.readFileSync(path.join(root,'app/api/account/delete/route.ts'),'utf8');
  ok(!deletionSource.includes('createAdminClient') && !deletionSource.includes('deleteUser('),
    'Withdrawal route has no service-role dependency or destructive fallback');
  const deletionUI=fs.readFileSync(path.join(root,'app/profile/DeleteAccountButton.tsx'),'utf8');
  ok(deletionUI.includes("response.status===200 && result.completed===true && result.state==='completed'") && deletionUI.includes('response.status!==202') && deletionUI.includes('退会申請は受け付けていません'),
    'Withdrawal UI logs out only after explicit completed response');


  for(const route of ['app/api/update/route.ts','app/api/rooms/mark-read/route.ts']) {
    f=fixture({noServices:true});res=await f.call(route,{});
    ok(res.status===410 && f.calls.length===0,'Retired redundant route '+route);
  }
  for(const [scenario,status] of [[{anonymous:true},401],[{room:{created_by:'other'}},403],[{room:{status:'forced_publish'}},403],[{room:{is_hidden:true}},404],[{},200]]) {
    f=fixture(scenario);const members=JSON.stringify(f.rows.room_members);
    res=await f.call('app/api/rooms/delete/route.ts',{roomId:'room'},!scenario.anonymous);
    ok(res.status===status && !f.calls.some(c=>c.operation==='delete') &&
      JSON.stringify(f.rows.room_members)===members && (status!==200 || f.rows.rooms[0].deleted_at),
      'Room deletion is authorized soft deletion '+JSON.stringify(scenario));
  }

  for(const [body,status] of [[{},400],[{confirm:true,attribution:'keep_name',policyVersion:'withdrawal-draft-2026-10-21'},400],[{confirm:true,attribution:'anonymous',policyVersion:'withdrawal-draft-2026-10-21',userId:'spoof'},202],[{confirm:true,attribution:'anonymous',policyVersion:'wrong'},400]]) {
    f=fixture({accountRequests:true});res=await f.call('app/api/account/delete/route.ts',body);
    ok(res.status===status && (status!==202 || f.calls.some(c=>c.name==='mvp_request_deletion' && c.args.p_actor==='actor')),
      'Withdrawal intake requires confirmed current policy and verified actor '+status);
  }

  for(const state of ['completed','retry','busy','needs_review','paused']) {
    f=fixture({accountRequests:true,finalize:true,workerState:state});
    res=await f.call('app/api/account/delete/route.ts',{confirm:true,attribution:'anonymous',policyVersion:'withdrawal-draft-2026-10-21',requestId:'forged',userId:'forged'});
    const result=await res.json();
    ok(res.status===(state==='completed'?200:202) && result.completed===(state==='completed') &&
      f.calls.some(c=>c.operation==='worker' && c.id==='request-fixture'),
      'Deletion finalization uses server job and distinguishes '+state);
  }
  for(const code of ['ACTIVE_CORE_ROOMS','UNPUBLISHED_CREATOR_ROOMS']) {
    f=fixture({accountRequests:true,finalize:true,workerState:'completed',deletionError:code});
    res=await f.call('app/api/account/delete/route.ts',{confirm:true,attribution:'anonymous',policyVersion:'withdrawal-draft-2026-10-21'});
    ok(res.status===409 && (await res.json()).code===code && !f.calls.some(c=>c.operation==='worker'),'Role refusal prevents worker '+code);
  }

  for(const [opts,token,body,status] of [
    [{finalize:false},'fixture-secret',{requestId:'11111111-1111-4111-8111-111111111111'},503],
    [{finalize:true,noSecret:true},'fixture-secret',{},503],
    [{finalize:true},'wrong',{requestId:'11111111-1111-4111-8111-111111111111'},401],
    [{finalize:true},'fixture-secret',{requestId:'../forged'},400],
    [{finalize:true,workerState:'completed'},'fixture-secret',{requestId:'11111111-1111-4111-8111-111111111111'},200]
  ]) {
    f=fixture(opts);
    res=await f.load('app/api/cron/account-deletion/route.ts').POST(new Request('https://example.invalid',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(body)}));
    ok(res.status===status && (status===200 || !f.calls.some(c=>c.operation==='worker')),'Finalization endpoint secret, flag and request boundary '+status);
  }
  for(const route of ['approve-core','reject-core']) {
    f=fixture({room:{created_by:'other'}});res=await f.call('app/api/rooms/'+route+'/route.ts',{roomId:'room',requestId:'request'});
    ok(res.status===403 && !f.calls.some(c=>c.name===route.replace('-','_')+'_request'),'Core management checks canonical Creator before privileged RPC '+route);
  }
  const ui=fs.readFileSync(path.join(root,'app/rooms/[id]/RoomDetailClient.tsx'),'utf8');
  for (const endpoint of ['join-supporter','request-core','approve-core','reject-core','leave']) {
    ok(ui.includes("fetch('/api/rooms/"+endpoint+"'"),'Current UI retains endpoint '+endpoint);
  }
  const page=fs.readFileSync(path.join(root,'app/rooms/[id]/page.tsx'),'utf8');
  const board=fs.readFileSync(path.join(root,'app/rooms/[id]/BoardClient.tsx'),'utf8');
  ok(!page.includes('OwnerCoreRequestsPanel') && page.includes('<RoomDetailClient'),'Page uses current participation/approval UI only');
  ok(!board.includes('JoinButton') && !fs.existsSync(path.join(root,'app/rooms/[id]/JoinButton.tsx')) &&
    !fs.existsSync(path.join(root,'app/rooms/[id]/OwnerCoreRequestsPanel.tsx')),'Obsolete UI callers removed');
  const reportBody={targetType:'post',targetId:'11111111-1111-4111-8111-111111111111',requestId:'22222222-2222-4222-8222-222222222222',reason:'fixture',reporter_user_id:'spoofed'};
  f=fixture({reportIntake:true});res=await f.call('app/api/reports/create/route.ts',reportBody);
  ok(res.status===202 && (await res.json()).receiptId==='receipt' && f.rows.reports.length===0,'Deferred report returns durable receipt without legacy fallback');
  ok(f.calls.find(x=>x.name==='mvp_receive_report').args.p_actor==='actor','Report actor comes from verified session');
  f=fixture({reportIntake:true,reportState:'processed'});res=await f.call('app/api/reports/create/route.ts',reportBody);
  ok(res.status===200,'Processed report accepted');
  f=fixture({reportIntake:true,rpcError:'PRIVATE'});res=await f.call('app/api/reports/create/route.ts',reportBody);
  ok(res.status===503 && !(await res.text()).includes('PRIVATE') && f.rows.reports.length===0,'Receipt failure sanitized without unsafe fallback');
  f=fixture({reportIntake:true});res=await f.call('app/api/reports/create/route.ts',{...reportBody,requestId:undefined});
  ok(res.status===400 && !f.calls.some(x=>x.name==='mvp_receive_report'),'Missing retry id rejected');
  f=fixture({reportIntake:true,anonymous:true});res=await f.call('app/api/reports/create/route.ts',reportBody);
  ok(res.status===401 && !f.calls.some(x=>x.name==='mvp_receive_report'),'Unauthenticated receipt refused');
  f=fixture({reportQueue:true});res=await f.call('app/api/moderation/reports/route.ts',{},true,'GET');
  let queue=await res.json();
  ok(res.status===200&&queue.items.length===50&&queue.next.afterId==='49'&&res.headers.get('Cache-Control')==='no-store','Operator queue bounded and noncacheable');
  f=fixture({reportQueue:true,anonymous:true});res=await f.call('app/api/moderation/reports/route.ts',{},true,'GET');
  ok(res.status===401&&!f.calls.some(x=>x.name==='mvp_pending_reports'),'Anonymous queue does not reach DB');
  f=fixture({reportQueue:true,rpcError:'PRIVATE'});res=await f.call('app/api/moderation/reports/route.ts',{},true,'GET');
  ok(res.status===403&&!(await res.text()).includes('PRIVATE'),'Queue permission failure exposes no rows or DB error');
  const resolution={receiptId:'11111111-1111-4111-8111-111111111111',requestId:'22222222-2222-4222-8222-222222222222',outcome:'no_action',note:'reviewed',confirm:true,actor:'spoofed'};
  f=fixture({reportQueue:true});res=await f.call('app/api/moderation/reports/route.ts',resolution);
  ok(res.status===200&&f.calls.find(x=>x.name==='mvp_resolve_report').args.p_actor==='actor','Resolution uses verified identity');
  f=fixture({reportQueue:true});res=await f.call('app/api/moderation/reports/route.ts',{...resolution,confirm:false});
  ok(res.status===400&&!f.calls.some(x=>x.name==='mvp_resolve_report'),'Resolution requires explicit confirmation');
  f=fixture({reportQueue:true,rpcError:'PRIVATE'});res=await f.call('app/api/moderation/reports/route.ts',resolution);
  ok(res.status===409&&res.headers.get('Cache-Control')==='no-store'&&!(await res.text()).includes('PRIVATE'),'Resolution failure sanitized and noncacheable');
  f=fixture();res=await f.call('app/api/moderation/reports/route.ts',{},true,'GET');
  ok(res.status===503&&!f.calls.some(x=>x.name==='mvp_pending_reports'),'Queue disabled by default');
  const intent='55555555-5555-4555-8555-555555555555';
  f=fixture({likeRequests:true});res=await f.call('app/api/rooms/like/route.ts',{roomId:'room',expected:false,desired:true,requestId:intent,userId:'spoof'});
  ok(res.status===200&&f.calls.find(c=>c.name==='mvp_set_room_like').args.p_actor==='actor'&&!f.calls.some(c=>c.operation==='insert'),'Atomic like uses verified actor and no fallback mutation');
  f=fixture({likeRequests:true});res=await f.call('app/api/rooms/like/route.ts',{roomId:'room'});
  ok(res.status===400&&!f.calls.some(c=>c.name==='mvp_set_room_like'),'Atomic like requires complete intent');
  f=fixture({likeRequests:true,rpcError:'PRIVATE'});res=await f.call('app/api/rooms/like/route.ts',{roomId:'room',expected:false,desired:true,requestId:intent});
  ok(res.status===409&&!(await res.text()).includes('PRIVATE')&&!f.calls.some(c=>c.operation==='insert'),'Atomic like failure never falls back to toggle');
  f=fixture({roomCreation:true});res=await f.call('app/api/rooms/create/route.ts',{title:'fixture',requestId:intent,created_by:'spoof'});
  ok(res.status===200&&f.calls.find(c=>c.name==='mvp_create_room').args.p_actor==='actor'&&!f.calls.some(c=>c.operation==='insert'),'Room creation delegates atomic operation with verified actor');
  f=fixture({roomCreation:true,rpcError:'PRIVATE'});res=await f.call('app/api/rooms/create/route.ts',{title:'fixture',requestId:intent});
  ok(res.status===409&&!f.calls.some(c=>c.operation==='insert'),'Failed atomic creation never falls back to partial inserts');
  for(const [file,options,method,body,operation]of [
   ['app/api/moderation/reports/route.ts',{reportQueue:true},'GET',{},'mvp_pending_reports'],
   ['app/api/moderation/reports/route.ts',{reportQueue:true},'POST',resolution,'mvp_resolve_report'],
   ['app/api/moderation/route.ts',{moderation:true},'POST',{},'mvp_moderate'],
   ['app/api/account/delete/route.ts',{accountRequests:true},'POST',{},'mvp_request_deletion'],
  ]){
   f=fixture({...options,guards:true,rateDenied:true});res=await f.call(file,body,true,method);
   ok(res.status===429&&!f.calls.some(c=>c.name===operation)&&res.headers.get('Cache-Control')==='no-store','Rate limit prevents privileged operation '+operation);
  }
  for(const options of [{member:null},{member:{left_at:'2020-01-01'}},{post:{is_hidden:true}},{post:{deleted_at:'2020-01-01'}},{room:{is_hidden:true}}]){
    f=fixture(options);res=await f.call('app/api/reports/create/route.ts',{targetType:'post',targetId:'post',reason:'fixture'});
    ok(res.status===503&&!f.calls.some(c=>c.operation==='insert'),'Disabled report intake rejects unavailable/private target '+JSON.stringify(options));
  }
  f=fixture({reportIntake:true,rpcError:'ALREADY_REPORTED'});res=await f.call('app/api/reports/create/route.ts',reportBody);
  ok(res.status===409&&!(await res.text()).includes('ALREADY_REPORTED'),'Duplicate target gets safe actionable response');
  for(const [file,opts,body] of [
    ['rooms/create',{roomCreation:false},{title:'fixture',requestId:intent}],
    ['rooms/join-supporter',{atomicJoin:false},joinBody],
    ['rooms/like',{likeRequests:false},{roomId:'room',expected:false,desired:true,requestId:intent}],
    ['reports/create',{reportIntake:false},reportBody],
    ['posts/toggle-mark',{membership:false},{roomId:'room',postId:'post'}],
    ['rooms/create',{roomCreation:true,guards:false},{title:'fixture',requestId:intent}],
  ]){
   f=fixture(opts);res=await f.call('app/api/'+file+'/route.ts',body);
   ok(res.status===503&&!f.calls.some(c=>['insert','update','upsert','delete'].includes(c.operation))&&f.calls.filter(c=>c.operation==='rpc').every(c=>c.name==='mvp_take_rate_limit'),'OFF fails closed: '+file+' '+JSON.stringify(opts));
  }
  f=fixture({drafts:false});res=await f.load('app/api/cron/publish/route.ts').GET(new Request('https://example.invalid',{headers:{authorization:'Bearer fixture-secret'}}));
  ok(res.status===503&&f.calls.length===0,'Publish OFF has no old RPC or direct update');
  for(const opts of [{accountRequests:true},{accountRequests:true,paused:true},{accountRequests:true,rpcError:'PRIVATE'},{accountRequests:false}]){
    f=fixture(opts);res=await f.call('app/api/account/delete/route.ts',{},false,'GET');
    ok((await res.json()).enabled===(!!opts.accountRequests&&!opts.paused&&!opts.rpcError),'Intake UI reflects durable pause and fails closed '+JSON.stringify(opts));
  }
  f=fixture({accountRequests:true,deletionError:'DELETION_PAUSED'});res=await f.call('app/api/account/delete/route.ts',{confirm:true,attribution:'anonymous',policyVersion:'withdrawal-draft-2026-10-21'});
  ok(res.status===503&&!(await res.text()).includes('DELETION_PAUSED')&&!f.calls.some(c=>c.operation==='worker'),'DB pause refuses intake without exposing database exception');
  console.log('Completed '+cases+' offline audit cases; GAP means vulnerability reproduced, not fixed. DB triggers/RLS are not simulated.');
})().catch(error=>{console.error(error);process.exitCode=1;});

