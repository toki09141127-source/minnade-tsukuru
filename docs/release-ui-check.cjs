/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('../node_modules/typescript');
let checks=0;const ok=()=>checks++;
function fixture(file,overrides={}){
 let states=[],index=0,effects=[],calls=[];const mockAuth={
  signUp:async p=>{calls.push(['signup',p]);return {error:null}},signInWithPassword:async p=>{calls.push(['signin',p]);return {error:null}},resetPasswordForEmail:async(e,o)=>{calls.push(['reset',o]);return {error:null}},
  initialize:async()=>({error:null}),getSession:async()=>({data:{session:{user:{id:'test'}}},error:null}),getUser:async()=>({data:{user:{id:'test'}},error:null}),
  updateUser:async p=>{calls.push(['password',p]);return {error:null}},signOut:async()=>{calls.push(['logout']);return {error:null}},...overrides.auth};
 const router={replace:p=>calls.push(['replace',p]),refresh:()=>{}};
 const react={useState:v=>{const n=index++;if(!(n in states))states[n]=v;return [states[n],v=>{states[n]=v}]},useRef:v=>{const n=index++;if(!(n in states))states[n]={current:v};return states[n]},useMemo:f=>f(),useEffect:f=>effects.push(f)};
 const jsx=(type,props)=>({type,props:props||{}}),cache={};
 const win={location:{origin:'https://staging.example.invalid',href:overrides.href||'https://staging.example.invalid/auth/callback?next=reset-password',replace:p=>calls.push(['external-replace',p])},history:{replaceState:()=>calls.push(['clear-url'])}};
 const load=f=>{f=path.resolve(f);if(cache[f])return cache[f];const mod={exports:{}};
 const req=n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'fragment'}:n==='next/navigation'?{useRouter:()=>router}:n==='next/link'?{default:'link'}:n.includes('supabase/client')?{supabase:{auth:mockAuth}}:n.includes('LegalLinks')?{default:()=>null}:load(n.startsWith('@/')?n.slice(2)+'.ts':path.resolve(path.dirname(f),n)+'.ts');
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:mod,exports:mod.exports,require:req,URL,URLSearchParams,window:win,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://auth.example.invalid'}}} ,{filename:f});return cache[f]=mod.exports};
 const mod=load(file);return {calls,mod,render:()=>{index=0;effects=[];return mod.default()},effects:()=>effects.map(f=>f()),auth:mockAuth};
}
function all(node,predicate){const out=[];function visit(n){if(!n||typeof n!=='object')return;if(Array.isArray(n))return n.forEach(visit);if(predicate(n))out.push(n);visit(n.props?.children)}visit(node);return out}
(async()=>{
 const h=fixture('lib/authFlow.ts').mod;
 assert.equal(h.callbackDestination('https://x/auth/callback?next=https://evil.invalid'),'/');ok();
 assert.equal(h.callbackDestination('https://x/auth/callback?error=expired'),null);ok();
 assert.equal(h.callbackDestination('https://x/auth/callback#type=recovery'),'/auth/reset-password');ok();
 assert.equal(h.authCallbackUrl('https://staging.invalid',true),'https://staging.invalid/auth/callback?next=reset-password');ok();
 assert(h.passwordError('short','short'));ok();assert(h.passwordError('long-enough','different'));ok();assert.equal(h.passwordError('long-enough','long-enough'),'');ok();
 const login=fixture('app/login/page.tsx');let tree=login.render();let inputs=all(tree,n=>n.type==='input');inputs.find(n=>n.props.type==='email').props.onChange({target:{value:'test@example.invalid'}});inputs.find(n=>n.props.type==='password').props.onChange({target:{value:'synthetic-password'}});
 tree=login.render();inputs=all(tree,n=>n.type==='input'&&n.props.type==='checkbox');inputs[1].props.onChange({target:{checked:true}});inputs[2].props.onChange({target:{checked:true}});
 tree=login.render();await all(tree,n=>n.type==='button')[0].props.onClick();assert.equal(login.calls.length,0);ok();
 all(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});tree=login.render();await all(tree,n=>n.type==='button')[0].props.onClick();assert.equal(login.calls[0][0],'signup');assert.equal(login.calls[0][1].options.data.adult_declared,true);assert.match(login.calls[0][1].options.emailRedirectTo,/\/auth\/callback$/);ok();
 const reset=fixture('app/auth/reset-password/page.tsx');reset.render();reset.effects();await new Promise(r=>setImmediate(r));tree=reset.render();inputs=all(tree,n=>n.type==='input');inputs[0].props.onChange({target:{value:'synthetic-password'}});inputs[1].props.onChange({target:{value:'mismatch'}});tree=reset.render();await all(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(reset.calls.length,0);ok();
 all(tree,n=>n.type==='input')[1].props.onChange({target:{value:'synthetic-password'}});tree=reset.render();await all(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});assert.deepEqual(reset.calls.map(x=>x[0]),['password','logout']);ok();
 const noSession=fixture('app/auth/reset-password/page.tsx',{auth:{getUser:async()=>({error:null,data:{user:null}})}});noSession.render();noSession.effects();await new Promise(r=>setImmediate(r));tree=noSession.render();assert.equal(all(tree,n=>n.type==='button')[0].props.disabled,true);ok();
 const bad=fixture('app/auth/callback/page.tsx',{auth:{initialize:async()=>({error:{message:'PRIVATE'}})}});bad.render();bad.effects();await new Promise(r=>setImmediate(r));assert(!bad.calls.some(x=>x[0]==='replace'));assert(bad.calls.some(x=>x[0]==='clear-url'));ok();
 const good=fixture('app/auth/callback/page.tsx');good.render();good.effects();await new Promise(r=>setImmediate(r));assert(good.calls.some(x=>x[0]==='replace'&&x[1]==='/auth/reset-password'));ok();
 // Every failure remains closed and only fixed, non-sensitive labels reach the page.
 for(const [auth,href,expected] of [
  [{initialize:async()=>({error:{code:'bad_code_verifier',message:'PRIVATE_AUTH_LINK'}})},undefined,'AUTH-04'],
  [{initialize:async()=>({error:{code:'flow_state_expired',message:'PRIVATE_AUTH_LINK'}})},undefined,'AUTH-02'],
  [{initialize:async()=>({error:{code:'flow_state_not_found',message:'PRIVATE_AUTH_LINK'}})},undefined,'AUTH-03'],
  [{initialize:async()=>({error:{name:'AuthRetryableFetchError',message:'PRIVATE_AUTH_LINK'}})},undefined,'AUTH-06'],
  [{getSession:async()=>({data:{session:null},error:null})},'https://staging.example.invalid/auth/callback?code=PRIVATE_AUTH_LINK','AUTH-05'],
  [{getSession:async()=>({data:{session:null},error:null})},undefined,'AUTH-07'],
  [{getUser:async()=>({data:{user:null},error:{message:'PRIVATE_AUTH_LINK'}})},undefined,'AUTH-08'],
  [{initialize:async()=>({error:{code:'PRIVATE_AUTH_LINK',message:'PRIVATE_AUTH_LINK'}})},undefined,'AUTH-09'],
  [{},'https://staging.example.invalid/auth/callback?error=PRIVATE_AUTH_LINK','AUTH-01'],
  [{},'https://staging.example.invalid/auth/callback?error=access_denied&error_code=otp_expired&error_description=PRIVATE_AUTH_LINK','AUTH-02'],
  [{},'https://staging.example.invalid/auth/callback#error=access_denied&error_code=otp_expired&error_description=PRIVATE_AUTH_LINK','AUTH-02'],
  [{},'https://staging.example.invalid/auth/callback#error=access_denied&error_code=PRIVATE_AUTH_LINK','AUTH-01'],
 ]){
  const f=fixture('app/auth/callback/page.tsx',{auth,href});f.render();f.effects();await new Promise(r=>setImmediate(r));
  const rendered=JSON.stringify(f.render());assert.ok(rendered.includes(expected));assert.ok(!rendered.includes('PRIVATE_AUTH_LINK'));assert.ok(!f.calls.some(x=>x[0]==='replace'));assert.ok(f.calls.some(x=>x[0]==='clear-url'));ok();
 }
 // Previewing a recovery email must never navigate to the one-time endpoint.
 const verify='https://auth.example.invalid/auth/v1/verify?'+new URLSearchParams({token:'SYNTHETIC_PRIVATE_VALUE_1234567890123456',type:'recovery',redirect_to:'https://staging.example.invalid/auth/callback?next=reset-password'});
 const gate=fixture('app/auth/confirm/page.tsx',{href:'https://staging.example.invalid/auth/confirm#'+new URLSearchParams({recovery_token:'SYNTHETIC_PRIVATE_VALUE_1234567890123456'})});
 gate.render();gate.effects();await new Promise(r=>setImmediate(r));tree=gate.render();
 assert(gate.calls.some(x=>x[0]==='clear-url'));assert(!gate.calls.some(x=>x[0]==='external-replace'));assert(!JSON.stringify(tree).includes('SYNTHETIC_PRIVATE_VALUE'));ok();
 const button=all(tree,n=>n.type==='button')[0];assert.equal(button.props.disabled,false);button.props.onClick();button.props.onClick();
 assert.equal(gate.calls.filter(x=>x[0]==='external-replace').length,1);assert.equal(gate.calls.find(x=>x[0]==='external-replace')[1],verify);ok();
 for (const kind of ['signup','recovery']) {
  const gate=fixture('app/auth/confirm/page.tsx',{href:'https://staging.example.invalid/auth/confirm#'+new URLSearchParams({[kind+'_token']:'SYNTHETIC_PRIVATE_VALUE_1234567890123456'})});
  gate.render();gate.effects();await new Promise(r=>setImmediate(r));const tree=gate.render();
  assert(!gate.calls.some(x=>x[0]==='external-replace'));assert(!JSON.stringify(tree).includes('SYNTHETIC_PRIVATE_VALUE'));ok();
  const button=all(tree,n=>n.type==='button')[0];assert.equal(button.props.disabled,false);button.props.onClick();button.props.onClick();
  assert.equal(gate.calls.filter(x=>x[0]==='external-replace').length,1);
  const url=new URL(gate.calls.find(x=>x[0]==='external-replace')[1]);assert.equal(url.searchParams.get('type'),kind);ok();
 }
 const invalidGate=fixture('app/auth/confirm/page.tsx',{href:'https://staging.example.invalid/auth/confirm#confirmation_url=https%3A%2F%2Fevil.invalid'});
 invalidGate.render();invalidGate.effects();await new Promise(r=>setImmediate(r));tree=invalidGate.render();
 assert(JSON.stringify(tree).includes('AUTH-10'));assert.equal(all(tree,n=>n.type==='button').length,0);assert(!invalidGate.calls.some(x=>x[0]==='external-replace'));ok();
 // Passwords are opaque: reset, signup and login must preserve the same exact value.
 const spaced=' synthetic-password ';
 const exact=fixture('app/login/page.tsx');tree=exact.render();
 all(tree,n=>n.type==='input'&&n.props.type==='email')[0].props.onChange({target:{value:'  test@example.invalid  '}});
 all(tree,n=>n.type==='input'&&n.props.type==='password')[0].props.onChange({target:{value:spaced}});
 for(const box of all(tree,n=>n.type==='input'&&n.props.type==='checkbox'))box.props.onChange({target:{checked:true}});
 tree=exact.render();await all(tree,n=>n.type==='button')[0].props.onClick();
 assert.equal(exact.calls.find(x=>x[0]==='signup')[1].password,spaced);ok();
 tree=exact.render();await all(tree,n=>n.type==='button')[1].props.onClick();
 assert.equal(exact.calls.find(x=>x[0]==='signin')[1].password,spaced);
 assert.equal(exact.calls.find(x=>x[0]==='signin')[1].email,'test@example.invalid');ok();
 const exactReset=fixture('app/auth/reset-password/page.tsx');exactReset.render();exactReset.effects();await new Promise(r=>setImmediate(r));tree=exactReset.render();
 for(const input of all(tree,n=>n.type==='input'))input.props.onChange({target:{value:spaced}});
 tree=exactReset.render();await all(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});
 assert.equal(exactReset.calls.find(x=>x[0]==='password')[1].password,spaced);ok();
 console.log(JSON.stringify({scope:'offline mocks; not real email or physical device',passed:checks}));
})().catch(e=>{console.error(e);process.exitCode=1});
