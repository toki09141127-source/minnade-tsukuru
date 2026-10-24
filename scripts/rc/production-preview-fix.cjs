/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto'),{createClient}=require('@supabase/supabase-js');
const out={scope:'AI source-constraint fix only; Hosted staging browser/API, real provider tested separately',complete:false,checks:[],productionChanges:'NONE',liveBilling:'OFF'};let h,c;
const ok=name=>out.checks.push({name,pass:true});
(async()=>{try{
 assert.ok(process.argv.includes('--preview'));h=await require('./harness.cjs')();const d=require('./preview-scope.cjs').deployment().d;out.preview=d.url;out.sourceCommit=d.sourceCommit;assert.equal(d.sourceCommit,'eafb75ec5f374d2dbdb2655d81576d4efe772c6d');
 const fixture=JSON.parse(fs.readFileSync('.staging-private/v2-rc-device-fixture.json'));assert.equal(fixture.projectRef,h.ctx.ref);const u=h.f.users.find(x=>x.label==='owner');assert.equal(u.id,fixture.creator);
 c=createClient(h.ctx.url,h.ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const auth=await c.auth.signInWithPassword({email:u.email,password:u.password});assert.ok(!auth.error);
 const p=await h.page(u);await p.goto(h.base+'/rooms/'+fixture.room);await p.getByRole('heading',{name:'TEST RC Android iPhone 実機検収',exact:true}).waitFor();await p.getByRole('button',{name:'AIまとめ',exact:true}).first().click();await p.getByText('AIは現在停止中です。人間の投稿・ドラフト編集は続けられます。',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'AIに依頼する',exact:true}).isEnabled(),false);ok('stopped AI visible; request disabled');
 await p.getByRole('button',{name:'制作ログ',exact:true}).click();await p.getByRole('heading',{name:'制作ログ',exact:true}).waitFor();await p.getByRole('button',{name:'完成作品ドラフト',exact:true}).click();await p.getByRole('button',{name:'完成作品ドラフトを保存',exact:true}).waitFor();ok('human log/draft controls remain accessible without writes');
 await p.goto(h.base+'/works/'+fixture.publishedWork);await p.locator('main h1').waitFor();ok('completed work still renders');
 const access=require('./preview-scope.cjs').access();const headers={Cookie:access.cookies.map(c=>c.name+'='+c.value).join('; '),'Content-Type':'application/json'};
 const call=async(token)=>{const r=await fetch(h.base+'/api/v2/ai',{method:'POST',headers:{...headers,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({roomId:fixture.room,requestId:crypto.randomUUID(),kind:'question',taskClass:'question',text:'TEST 停止中の確認'}),redirect:'error'});return {status:r.status,body:await r.json()}};
 assert.equal((await call(null)).status,401);ok('Preview access does not grant application authorization');const stopped=await call(auth.data.session.access_token);assert.equal(stopped.status,503);assert.equal(stopped.body.code,'AI_UNAVAILABLE');ok('AI stop remains enforced server-side');
 assert.equal(h.errors.length,0);assert.equal(h.consoleErrors.length,0);assert.equal(h.http500.length,0);assert.equal(h.browserMetrics.hydrationErrors,0);assert.equal(h.browserMetrics.app401,0);out.browser={uncaught:0,appConsoleErrors:0,http500:0,hydrationErrors:0,app401:0,excludedExternalConsole:h.browserMetrics.ignoredExternalConsoleErrors};ok('no application error, hydration failure, 5xx or authentication loop');
 out.complete=true;
 }catch(e){out.failure={code:typeof e.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:'CHECK_FAILED',label:/^[A-Z_]+$/.test(e.message||'')?e.message:'ASSERTION_OR_UI_TIMEOUT'};process.exitCode=1}
 finally{if(c){await c.auth.signOut();out.syntheticCreatorSessionsSignedOut=true;}if(h){await h.close();out.browserClosed=true;}fs.writeFileSync('docs/v2-production-preview-fix-result.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));}
})();
