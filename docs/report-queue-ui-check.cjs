/* eslint-disable @typescript-eslint/no-require-imports -- Offline component regression. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
function fixture(file='app/moderation/ReportQueue.tsx'){
 let slots=[],index=0,effect,listener,cleanup,session=Promise.resolve({data:{session:{access_token:'fixture'}}}),calls=[];
 const react={useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},
 useRef(initial){const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i]},
 useEffect(fn){if(!effect){effect=fn;cleanup=fn()}}};
 const jsx=(type,props)=>({type,props});
 const compiled={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports:compiled.exports,module:compiled,require(name){if(name==='./ReportQueue')return {default:()=>null};if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};return {supabase:{from(){const query={select(){return query},eq(){return query},maybeSingle:async()=>({data:null,error:null})};return query},auth:{getUser:async()=>({data:{user:{id:'fixture'}}}),getSession:()=>session,onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){}}}}}}}}},
 fetch(...args){const d=deferred();calls.push({args,...d});return d.promise},queueMicrotask,URLSearchParams,crypto:{randomUUID:()=> 'test-request'},window:{confirm:()=>true}});
 const render=()=>{index=0;return compiled.exports.default({roomId:'room'})};
 const nodes=(node)=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];
 const button=text=>nodes(render()).find(x=>x.type==='button'&&x.props.children===text);
 return {slots,calls,render,button,change:()=>listener(),unmount:()=>cleanup(),setSession:p=>session=p,nodes};
}
const tick=()=>new Promise(setImmediate);
const item={id:'receipt',target_type:'post',target_id:'target',reason:'fixture',created_at:'now'};
const response={ok:true,json:async()=>({items:[item],next:null,total:1,overdue:0,oldest:null,checkedAt:'now'})};
let n=0;const ok=(value,label)=>{assert.ok(value,label);console.log('PASS '+(++n)+' '+label)};
(async()=>{
 let f=fixture(),s=deferred();f.setSession(s.promise);f.button('一覧を更新').props.onClick();f.change();s.resolve({data:{session:{access_token:'old'}}});await tick();
 ok(f.calls.length===0&&f.slots[0].length===0,'Auth change during session lookup prevents old request');
 f=fixture();const click=f.button('一覧を更新').props.onClick;click();click();await tick();ok(f.calls.length===1,'Same-tick double click sends only one request');
 f.change();f.button('一覧を更新').props.onClick();await tick();f.calls[0].reject(Error('old'));await tick();
 ok(f.slots[3]===''&&f.slots[4]===true,'Old rejection does not show error or unlock newer operation');
 f.calls[1].resolve(response);await tick();ok(f.slots[0].length===1&&f.slots[4]===false,'Current operation completes normally');
 f=fixture();f.button('一覧を更新').props.onClick();await tick();f.change();f.calls[0].resolve(response);await tick();
 ok(f.slots[0].length===0&&f.slots[2]==='','Late success cannot restore former account data');
 f=fixture();f.button('一覧を更新').props.onClick();await tick();f.unmount();const before=JSON.stringify(f.slots.slice(0,6));f.calls[0].reject(Error());await tick();
 ok(JSON.stringify(f.slots.slice(0,6))===before,'Unmount invalidates late catch and finally');
 f=fixture();f.button('一覧を更新').props.onClick();await tick();f.calls[0].resolve(response);await tick();
 f.nodes(f.render()).find(x=>x.type==='textarea').props.onChange({target:{value:'reviewed'}});
 const action=f.button('非表示にして対応済み').props.onClick;action();action();await tick();
 ok(f.calls.length===2,'Duplicate resolution click sends only one mutation');
 f.calls[1].reject(Error('lost response'));await tick();f.button('非表示にして対応済み').props.onClick();await tick();
 ok(f.calls[1].args[1].body===f.calls[2].args[1].body,'Unknown result retry retains exact request and note');
 f.change();f.calls[2].resolve({ok:true});await tick();
 ok(f.slots[0].length===0&&f.slots[3]==='','Late resolution does not show success after auth change');
 f=fixture('app/moderation/page.tsx');f.render();f.nodes(f.render()).find(x=>x.type==='input'&&x.props.required).props.onChange({target:{value:'target'}});
 let form=f.nodes(f.render()).find(x=>x.type==='form').props.onSubmit;
 form({preventDefault(){}});form({preventDefault(){}});await tick();
 ok(f.calls.length===1,'Standalone moderation double submit prevented');
 f.calls[0].reject(Error());await tick();f.nodes(f.render()).find(x=>x.type==='form').props.onSubmit({preventDefault(){}});await tick();
 ok(f.calls[0].args[1].body===f.calls[1].args[1].body,'Standalone moderation unknown result reuses intent ID');
 f.change();f.calls[1].resolve({ok:true});await tick();
 ok(f.slots[5]===''&&f.slots[1]==='','Standalone moderation auth change clears target and suppresses late success');
 f=fixture('app/rooms/[id]/LikeButton.tsx');f.render();await tick();
 const like=f.button('♡ いいね').props.onClick;like();like();await tick();
 ok(f.calls.length===1,'Like same-tick double click sends one request');
 f.calls[0].reject(Error());await tick();f.button('♡ いいね').props.onClick();await tick();
 ok(f.calls[0].args[1].body===f.calls[1].args[1].body,'Like retry preserves intent instead of toggling again');
 f.change();f.calls[1].resolve({ok:true,json:async()=>({ok:true,liked:true})});await tick();
 ok(f.slots[0]===false&&f.slots[3]==='','Like auth change suppresses old response');
 console.log('Completed '+n+' report queue UI checks; offline component harness.');
})().catch(e=>{console.error(e);process.exitCode=1});
