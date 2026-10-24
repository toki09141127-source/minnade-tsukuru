/* eslint-disable @typescript-eslint/no-require-imports -- Local or exact-approved Preview reconsent verification using one synthetic account. */
const fs=require('fs'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js');
const report={complete:false,checks:[],productionChanges:'NONE',humanConsentModified:false};let h,c,step='setup';
const ok=name=>report.checks.push({name,pass:true});
(async()=>{try{
 h=await require('./harness.cjs')();report.scope=h.hosted?'exact-approved Hosted Preview':'localhost app with staging synthetic user';
 const u=h.f.users.find(x=>x.label==='owner');assert.ok(u);report.syntheticAccountLabel='RC owner fixture';
 c=createClient(h.ctx.url,h.ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const a=await c.auth.signInWithPassword({email:u.email,password:u.password});assert.ok(!a.error);assert.equal(a.data.user.id,u.id);
 const read=async()=>{const r=await c.from('profiles').select('terms_version,privacy_version,adult_confirmed_at,terms_agreed_at,privacy_agreed_at').eq('id',u.id).single();assert.ok(!r.error);return r.data};
 const before=await read();const old=before.terms_version!=='2026-10-24'||before.privacy_version!=='2026-10-24';
 step='login';const p=await h.page(u);const dialog=p.getByRole('dialog',{name:'利用規約・プライバシーポリシーの再同意'});
 if(old){
  step='explicit-consent-ui';await dialog.waitFor();assert.deepEqual(await read(),before);ok('Old consent prompts; merely viewing does not consent');
  const boxes=dialog.getByRole('checkbox');assert.equal(await boxes.count(),3);for(let i=0;i<3;i++)assert.equal(await boxes.nth(i).isChecked(),false);
  const submit=dialog.getByRole('button',{name:'同意して続ける',exact:true});assert.equal(await submit.isEnabled(),false);
  await dialog.getByText(/退会後も共同作品・使用済み添付を保持/).waitFor();ok('New retention and initial free-release changes shown; no prechecked consent');
  report.widths=[320,375,390,768,1440];for(const width of report.widths){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const b=await submit.boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=900)}ok('Reconsent action visible with no horizontal overflow at five widths');
  await p.addScriptTag({content:fs.readFileSync('.staging-private/ui-tools/node_modules/axe-core/axe.min.js','utf8')});
  report.axeViolations=await p.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(x=>x.id));
  assert.equal(report.axeViolations.length,0);ok('Reconsent dialog accessibility checks: zero violations');
  await boxes.nth(0).check();await boxes.nth(1).check();assert.equal(await submit.isEnabled(),false);await boxes.nth(2).check();assert.equal(await submit.isEnabled(),true);
  await submit.click();await dialog.waitFor({state:'hidden'});ok('Only all explicit checks allow authenticated consent submission');
 }else{ok('Previously accepted synthetic consent does not prompt again');report.consentAlreadyAccepted=true;}
 step='persistence';const after=await read();assert.equal(after.terms_version,'2026-10-24');assert.equal(after.privacy_version,'2026-10-24');assert.ok(after.adult_confirmed_at&&after.terms_agreed_at&&after.privacy_agreed_at);
 await p.reload();await p.locator('main').waitFor();assert.equal(await dialog.count(),0);ok('Matching Terms/Privacy versions and dates persist after reload');
 for(const [url,text] of [['/terms','通常の公開名義は「退会したメンバー」'],['/terms?tab=privacy','Supabaseを認証・データベース・ファイル保存']]){step='public-legal-page';await p.goto(h.base+url);await p.getByText(new RegExp(text)).waitFor();ok('Published document contains adopted wording '+url);}
 assert.equal(h.errors.length,0);assert.equal(h.consoleErrors.length,0);assert.equal(h.http500.length,0);assert.equal(h.browserMetrics.hydrationErrors,0);ok('No app console, hydration, uncaught or 5xx error');report.complete=true;
 }catch{report.failure={step,code:'CHECK_FAILED'};process.exitCode=1}
 finally{if(c){await c.auth.signOut();report.syntheticSessionSignedOut=true}if(h){await h.close();report.browserAndLocalServerClosed=true}
 fs.writeFileSync(h?.hosted?'docs/v2-consent-preview-result.json':'docs/v2-consent-browser-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
})();
