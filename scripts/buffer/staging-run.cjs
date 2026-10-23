/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path');
const {root,env,ctx,rpc,load}=require('./staging-context.cjs');
const mode=process.argv[2]||'dry-run';
async function main(){
 const transportEvidence=[];
 const transport=async(input,init)=>{
  const r=await fetch(input,init);
  try {
   const request=JSON.parse(init.body),b=await r.clone().json();
   const op=/mutation (\w+)/.exec(request.query)?.[1];
   if(op){
    const result=b.data?.editPost||b.data?.createPost||b.data?.deletePost;
    const message=typeof result?.message==='string'?result.message:'';
    const category=/duplicate|already exists/i.test(message)?'DUPLICATE':/text|content.*required/i.test(message)?'CONTENT':/time|date|schedule/i.test(message)?'SCHEDULE':/permission|access|authoriz/i.test(message)?'ACCESS':message?'OTHER_REJECTION':null;
    transportEvidence.push({operation:op,httpStatus:r.status,resultType:/^[A-Za-z]+$/.test(result?.__typename||'')?result.__typename:null,graphqlErrors:Array.isArray(b.errors)?b.errors.length:0,category});
   }
  }catch{/* Diagnostics must not affect transport or expose raw responses. */}
  return r;
 };
 const sender=load(path.join(root,'lib/buffer/sender.ts')).createBufferSender(env.BUFFER_API_KEY||'',transport);
 const {runBuffer}=load(path.join(root,'lib/buffer/worker.ts'));
 const {runTestCanary}=load(path.join(root,'lib/buffer/testCanary.ts'));
 if(env.BUFFER_RUN_MODE&&env.BUFFER_RUN_MODE!=='dry-run')throw Error('AUTO_SEND_MUST_REMAIN_OFF');
 let result;
 if(mode==='dry-run')result=await runBuffer(rpc,sender,'dry-run');
 else if(mode==='canary-dry-run')result=await runTestCanary(rpc,sender,true);
 else if(mode==='maintain'){
  const {maintainBuffer}=load(path.join(root,'lib/buffer/lifecycle.ts'));
  result=await maintainBuffer(rpc,sender);
 }else if(mode==='maintain-held-test'){
  const s=await rpc('buffer_test_snapshot'); const a=s.data?.authorization; if(s.error||!a)throw Error('TEST_AUTH_REQUIRED');
  const {maintainBuffer}=load(path.join(root,'lib/buffer/lifecycle.ts'));
  const {validateScheduledTestCanary}=load(path.join(root,'lib/buffer/promotionPlanner.ts'));
  result=await maintainBuffer(rpc,sender,(c,p,now)=>p.eventId===a.event_id&&p.text===a.body&&Date.parse(p.dueAt)===Date.parse(a.due_at)&&validateScheduledTestCanary(c,p,now),a.event_id);
 }else if(mode==='check'){
  if(!env.BUFFER_API_KEY)throw Error('BUFFER_API_KEY_REQUIRED');
  result={api:await sender.preflight()?'PASS':'FAIL',mutation:false};
 }else if(mode==='reserve-held-test'){
  result=await runTestCanary(rpc,sender,false,true,true);
 }else if(mode==='reserve-one'){
  if(!env.BUFFER_API_KEY)throw Error('BUFFER_API_KEY_REQUIRED');
  result=await runTestCanary(rpc,sender,false);
 }else if(mode==='reconcile'){
  if(!env.BUFFER_API_KEY)throw Error('BUFFER_API_KEY_REQUIRED');
  const s=await rpc('buffer_test_snapshot');
  if(s.error||!s.data?.receipt?.buffer_id)throw Error('BUFFER_RECEIPT_REQUIRED');
  const q=s.data.receipt,p={eventId:q.event_id,contentKey:q.content_key,kind:q.kind,dueAt:q.due_at,text:q.body};
  const receipt=await sender.inspect(q.buffer_id,p);
  const update=await rpc('buffer_reconcile',{p_event:q.event_id,p_buffer_id:q.buffer_id,p_state:receipt.state,p_sent:receipt.sentAt||null,p_external:receipt.externalUrl||null});
  if(update.error||(!update.data&&q.state!=='sent'))throw Error('RECONCILE_FAILED');
  result={state:receipt.state,sentAt:receipt.sentAt,externalUrl:receipt.externalUrl,mutation:false};
 }else throw Error('INVALID_MODE');
 const output={projectRef:ctx.ref,checkedAt:new Date().toISOString(),mode,result,transportEvidence,productionConnected:false,autoSend:'OFF'};
 fs.writeFileSync(path.join(root,'docs/buffer-staging-'+mode+'-result.json'),JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify(output));
}
main().catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'BUFFER_STAGING_FAILED');process.exitCode=1});
