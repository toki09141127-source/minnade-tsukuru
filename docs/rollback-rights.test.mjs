import {test} from 'node:test'
import assert from 'node:assert/strict'
import {enabled,stagingUrl,handle,contract} from '../lib/rollback-rights/contract.ts'
const env={NEXT_PUBLIC_SUPABASE_URL:stagingUrl,VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_Qo1OsPU4tdgA2fluqzbAr1kTk6Dy',VERCEL_GIT_COMMIT_REF:'codex/v2-rollback-rights-only-20261127'}
const room='b52a2916-53d7-4dd9-98ba-aba2ca1823c9', rid='1c2f3128-9653-40bd-b086-4ca3df087ea0', h='c'.repeat(64), base='https://staging.example.invalid/api/v3/visibility/publication'
const mutation={action:'revoke',roomId:room,requestId:rid,previewHash:h,reviewed:true,itemId:'fixture-item'}
const row={id:'fixture-item',previewHash:h,kind:'text',target:'block:one',granted:true,canRevoke:true}
const goodRights={contract,roomId:room,previewHash:h,items:[row]}
const goodRevoke={contract,roomId:room,previewHash:h,action:'revoke',outcome:'revoked'}
function get(query='?roomId='+room+'&view=rights', auth='Bearer synthetic'){
  return new Request(base+query,{headers:auth?{authorization:auth}:{}})
}
function post(payload=mutation, headers={}){
  return new Request(base,{method:'POST',headers:{authorization:'Bearer synthetic',origin:new URL(base).origin,'content-type':'application/json',...headers},body:JSON.stringify(payload)})
}
function stub(data,auth=true,error=null){
  const calls=[]
  const client=()=>({authenticated:async()=>auth,rpc:async args=>{calls.push(args);return {data,error}}})
  return {calls,client}
}
test('only named protected staging preview configuration can enable',()=>{
  assert(enabled(env))
  for(const patch of [{VERCEL_ENV:'production'},{VERCEL_TARGET_ENV:'production'},{VERCEL_PROJECT_ID:'other'},{VERCEL_GIT_COMMIT_REF:'main'},{NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'},{V3_ROLLBACK_WITHDRAWAL_ENABLED:'false'}]) assert(!enabled({...env,...patch}))
})
test('closed and anonymous paths do not invoke the client',async()=>{
  const fail=()=>assert.fail('should not build a client')
  assert.equal((await handle(get(),false,fail)).status,503)
  assert.equal((await handle(get(undefined,''),true,fail)).status,401)
})
test('auth claim must be checked before any RPC',async()=>{
  const s=stub(goodRights,false)
  assert.equal((await handle(get(),true,s.client)).status,401)
  assert.deepEqual(s.calls,[])
})
test('blocks other views and duplicate query keys',async()=>{
  const s=stub(goodRights)
  for(const q of ['review','preview','public','stop']) assert.equal((await handle(get('?roomId='+room+'&view='+q),true,s.client)).status,400)
  assert.equal((await handle(get('?roomId='+room+'&view=rights&view=rights'),true,s.client)).status,400)
  assert.deepEqual(s.calls,[])
})
test('blocks other actions and foreign origins before RPC',async()=>{
  const s=stub(goodRevoke)
  for(const action of ['grant','publish','prepare','stop','status']) assert.equal((await handle(post({...mutation,action}),true,s.client)).status,400)
  assert.equal((await handle(post(mutation,{origin:'https://outside.example.invalid'}),true,s.client)).status,400)
  assert.equal((await handle(post({...mutation,reviewed:false}),true,s.client)).status,400)
  assert.deepEqual(s.calls,[])
})
test('reads only the holder projection and disables caching',async()=>{
  const s=stub(goodRights)
  const out=await handle(get(),true,s.client)
  assert.equal(out.status,200)
  assert.match(out.headers.get('cache-control'),/no-store/)
  assert.deepEqual(await out.json(),goodRights)
  assert.deepEqual(s.calls,[{p_action:'rights',p_room:room,p_request:null,p_payload:{contract}}])
})
test('rejects private body, duplicate permission rows, or a mismatched room',async()=>{
  for(const data of [{...goodRights,body:'do not expose'}, {...goodRights,items:[row,row]}, {...goodRights,roomId:rid}]){
    const s=stub(data)
    assert.deepEqual(await (await handle(get(),true,s.client)).json(),{error:'RIGHTS_UNCONFIRMED'})
  }
})
test('only passes pinned revoke payload and requires matching receipt',async()=>{
  const s=stub(goodRevoke)
  const out=await handle(post(),true,s.client)
  assert.equal(out.status,200)
  assert.deepEqual(await out.json(),goodRevoke)
  assert.deepEqual(s.calls,[{p_action:'revoke',p_room:room,p_request:rid,p_payload:{...mutation,contract}}])
  assert.equal((await handle(post(),true,stub({...goodRevoke,previewHash:'d'.repeat(64)}).client)).status,503)
})
test('database ineligibility is not converted into successful revoke',async()=>{
  const out=await handle(post(),true,stub(null,true,{message:'internal text'}).client)
  assert.equal(out.status,409)
  assert.deepEqual(await out.json(),{error:'RIGHTS_UNCONFIRMED'})
})
