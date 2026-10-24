/* eslint-disable @typescript-eslint/no-require-imports -- Exact approved staging Preview diagnostics; no Auth requests. */
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const out = { complete: false, scope: 'Hosted diagnostic UI only; no real email or session exchange', checks: [], authRequestsBlocked: 0, productionChanges: 'NONE' };
let harness, currentPage;
(async () => {
  try {
    assert.ok(process.argv.includes('--preview'));
    assert.equal(process.env.RC_APPROVED_PREVIEW_URL, 'https://minnade-tsukuru-staging-b7zdudurb-sonetokiyas-projects.vercel.app');
    harness = await require('./harness.cjs')();
    out.url = harness.base;
    for (const item of [
      { name: 'known-link-expiry', query: '?error=access_denied&error_code=otp_expired', status: 'AUTH-02' },
      { name: 'missing-browser-state', query: '?code=synthetic-code&next=reset-password', status: 'AUTH-05' },
      { name: 'missing-session', query: '', status: 'AUTH-07' },
    ]) {
      const page = await harness.page();
      currentPage = page; out.phase = item.name;
      await page.route('**/auth/v1/**', route => { out.authRequestsBlocked++; return route.abort(); });
      await page.goto(harness.base + '/auth/callback' + item.query);
      await page.getByText('確認コード：' + item.status).waitFor();
      const location = new URL(page.url());
      assert.equal(location.pathname, '/auth/callback'); assert.equal(location.search, ''); assert.equal(location.hash, '');
      const body = await page.locator('body').innerText();
      assert.equal(body.includes('synthetic-code'), false);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
      out.checks.push({ name: item.name, code: item.status, pass: true, widths: [320, 390, 1440] });
      await page.context().close();
    }
    const page = await harness.page(); currentPage = page; out.phase = 'explicit-confirmation';
    await page.route('**/auth/v1/**',route=>{out.authRequestsBlocked++;return route.abort();});
    await page.goto(harness.base+'/auth/confirm#recovery_token=SYNTHETIC_PRIVATE_VALUE_1234567890123456');
    const button=page.getByRole('button',{name:'再設定を続ける',exact:true});await button.waitFor();assert.equal(await button.isEnabled(),true);
    assert.equal(new URL(page.url()).hash,'');assert.equal(new URL(page.url()).search,'');
    assert.equal((await page.locator('body').innerHTML()).includes('SYNTHETIC_PRIVATE_VALUE'),false);
    assert.equal(await page.locator('a[href*="/auth/v1/verify"]').count(),0);
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    await page.addScriptTag({content:fs.readFileSync('.staging-private/ui-tools/node_modules/axe-core/axe.min.js','utf8')});
    const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(x=>x.id));assert.equal(violations.length,0);
    out.checks.push({name:'explicit-confirmation-no-auth-before-click',pass:true,widths:[320,390,1440],axeViolations:violations,buttonNotClicked:true});
    await page.context().close();
    out.uncaught = harness.errors.length; out.serverErrors = harness.http500.length;
    out.consoleErrors = harness.consoleErrors.length; out.hydrationErrors = harness.browserMetrics.hydrationErrors;
    assert.equal(out.authRequestsBlocked, 0); assert.equal(out.uncaught, 0); assert.equal(out.serverErrors, 0); assert.equal(out.consoleErrors, 0); assert.equal(out.hydrationErrors, 0);
    out.complete = true;
  } catch { out.failure = 'HOSTED_DIAGNOSTIC_CHECK_FAILED'; out.visibleStatus = currentPage ? (await currentPage.locator('body').innerText().catch(() => '')).match(/AUTH-0[1-9]/)?.[0] || 'NO_STATUS' : 'NO_PAGE'; process.exitCode = 1; }
  finally {
    if (harness) { await harness.close(); out.browserClosed = !harness.browser.isConnected(); }
    const file = path.resolve('.staging-private/v2rc-preview-access.json');
    if (fs.existsSync(file)) {
      const access = JSON.parse(fs.readFileSync(file));
      if (access.url === process.env.RC_APPROVED_PREVIEW_URL) fs.unlinkSync(file);
    }
    out.cookieDeleted = !fs.existsSync(file); out.observedAt = new Date().toISOString();
    fs.writeFileSync('docs/v2-recovery-confirmation-preview-result.json', JSON.stringify(out, null, 2) + '\n');
    console.log(JSON.stringify(out));
  }
})();
