/* eslint-disable @typescript-eslint/no-require-imports */
// Offline regression for rollout blockers. No real external calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const now='2026-10-22T11:20:00Z';
function load(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Date:class extends Date{static now(){return Date.parse(now)}},require:n=>load(path.resolve(path.dirname(file),n+'.ts'))});return m.exports;}
const {runManagedBuffer}=load('lib/buffer/lifecycle.ts');
const {planPromotions}=load('lib/buffer/promotionPlanner.ts');
const c={id:'completed_test',kind:'completed',targetId:'test',createdAt:'2026-10-22T00:00:00Z',expiresAt:'2026-10-29T00:00:00Z',snapshotAt:now,public:true,hidden:false,deleted:false,pendingReport:false,creatorExcluded:false,reviewed:true,piiClear:true,title:'合成作品'};
const p=planPromotions([c],[],now)[0];let state='queued',hidden=false,sends=0,inspects=0,cancels=0,checked=false,enabled=true;
const rpc=async(name,args)=>{let data;
 if(name==='buffer_snapshot')data={now,candidates:hidden?[]:[c],history:state==='queued'?[]:[{eventId:p.eventId,contentKey:p.contentKey,kind:p.kind,dueAt:p.dueAt,state:'sent'}],queue:state==='queued'?[{event_id:p.eventId,content_key:p.contentKey,kind:p.kind,due_at:p.dueAt,body:p.text}]:[]};
 else if(name==='buffer_reserve')data=0;
 else if(name==='buffer_claim')data=state==='queued'?{event_id:p.eventId,content_key:p.contentKey,kind:p.kind,due_at:p.dueAt,body:p.text,token:'synthetic'}:null;
 else if(name==='buffer_finish'){state=args.p_state==='succeeded'?'scheduled':args.p_state;data=true;}
 else if(name==='buffer_control_state')data={enabled,reason:enabled?'READY':'EXCLUDED'};
 else if(name==='buffer_send_guard')data=enabled;
 else if(name==='buffer_stop'){enabled=false;data=true;}
 else if(name==='buffer_delivery_claim'){data=state==='scheduled'&&!checked?{event_id:p.eventId,content_key:p.contentKey,kind:p.kind,due_at:p.dueAt,body:p.text,buffer_id:'synthetic',delivery_token:'synthetic',cancel_requested:false}:null;if(data)checked=true;}
 else if(name==='buffer_delivery_finish'){state=args.p_state;data=true;}
 else if(name==='buffer_delivery_cancel_mark')data=true;
 else throw Error('unexpected RPC');return {data,error:null};};
const sender={preflight:async()=>true,send:async()=>{sends++;return {state:'succeeded',code:'BUFFER_ACCEPTED',id:'synthetic',dueAt:p.dueAt};},inspect:async()=>{inspects++;return {state:'held',cancellable:true};},cancel:async()=>{cancels++;return 'cancelled';}};
(async()=>{await runManagedBuffer(rpc,sender,'automatic');assert.equal(state,'scheduled');hidden=true;checked=false;await runManagedBuffer(rpc,sender,'automatic');assert.equal(sends,1);assert.equal(cancels,1);assert.ok(inspects>=2);assert.equal(state,'cancelled');assert.equal(enabled,false);const result={offline:true,networkCalls:0,productionChanges:0,blockers:[{id:'POST_RESERVATION_EXCLUSION',reproduced:false,explanation:'After exclusion the managed worker cancels the external reservation and stops new sending.'},{id:'AUTOMATIC_RECEIPT_RECONCILIATION',reproduced:false,explanation:'The managed worker reads accepted ordinary receipts.'}],sendsSynthetic:sends,cancellations:cancels,receiptReads:inspects};fs.writeFileSync('docs/buffer-production-blockers.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));})().catch(e=>{console.error(e.message);process.exitCode=1;});
