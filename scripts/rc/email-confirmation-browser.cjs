/* eslint-disable @typescript-eslint/no-require-imports -- Local browser + actual SDK, all Auth responses synthetic. */
const fs = require('fs'), path = require('path'), cp = require('child_process'), net = require('net'), crypto = require('crypto'), assert = require('node:assert/strict');
const out = { complete: false, scope: 'localhost Chromium with installed Supabase SDK; mocked Auth, no email sent', checks: [], productionChanges: 'NONE', remoteAuthRequests: 0 };
let server, browser, phase = 'setup', currentPage, serverOutput = '';
const pause = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try {
    const config = require('../staging/safety.cjs').load();
    const socket = net.createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r)); const port = socket.address().port; await new Promise(r => socket.close(r));
    const base = 'http://127.0.0.1:' + port;
    phase = 'local-server';
    server = cp.spawn(process.execPath, ['--require', path.resolve('scripts/rc/auth-callback-test-network.cjs'), 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, STAGING_TEST: 'true', AUTH_CALLBACK_OFFLINE_TEST: 'true', NEXT_PUBLIC_SUPABASE_URL: config.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: config.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: '', AI_ENABLED: 'false' } });
    server.stdout.on('data', x => { serverOutput = (serverOutput + x).slice(-8000); }); server.stderr.on('data', x => { serverOutput = (serverOutput + x).slice(-8000); });
    let ready = false; for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '/login', {signal:AbortSignal.timeout(2000)})).ok) { ready = true; break; } } catch {} await pause(500); } assert.ok(ready, 'LOCAL_READY');
    phase = 'browser-launch'; const { chromium } = require(path.join(config.env.MVP_TEST_RUNTIME, 'node_modules/playwright-core'));
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'callback@example.invalid', app_metadata: {}, user_metadata: {} };
    for (const flow of ['signup','recovery']) for (const mode of ['new-tab-success', 'prefetch-then-confirm', 'missing-verifier', 'mismatch', 'expired']) {
      const callback = '/auth/callback' + (flow === 'recovery' ? '?next=reset-password&' : '?') + 'code=synthetic-code';
      const buttonName = flow === 'signup' ? 'メールアドレスを確認する' : '再設定を続ける';
      phase = flow + ':' + mode + ':start';
      const context = await browser.newContext(); let challenge, exchanges = 0, verified = 0, challengeMatches = false, verificationVisits = 0;
      const handler = async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base) { assert.equal(request.url().includes('SYNTHETIC_PRIVATE_VALUE'),false); assert.equal((request.headers().referer||'').includes('SYNTHETIC_PRIVATE_VALUE'),false); return route.continue(); }
        if (url.origin !== config.url) return route.abort();
        const json = data => route.fulfill({ json: data });
        if (url.pathname === (flow === 'signup' ? '/auth/v1/signup' : '/auth/v1/recover')) { const data = request.postDataJSON(); assert.equal(data.code_challenge_method, 's256'); challenge = data.code_challenge; return json(flow === 'signup' ? {user,session:null} : {}); }
        if (url.pathname === '/auth/v1/verify') {
          verificationVisits++; assert.equal(mode, 'prefetch-then-confirm'); assert.equal(url.searchParams.get('type'), flow);
          return route.fulfill({status:303,headers:{location:base+callback},body:''});
        }
        if (url.pathname === '/auth/v1/token') {
          exchanges++; const data = request.postDataJSON(); challengeMatches = crypto.createHash('sha256').update(data.code_verifier).digest('base64url') === challenge;
          if (!['new-tab-success','prefetch-then-confirm'].includes(mode)) return route.fulfill({ status: 400, headers: { 'x-supabase-api-version': '2024-01-01', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-supabase-api-version' }, json: { code: mode === 'expired' ? 'flow_state_expired' : 'bad_code_verifier', message: 'SYNTHETIC_PRIVATE_ERROR' } });
          assert.ok(challengeMatches); return json({ access_token: 'offline-callback-test', refresh_token: 'offline-refresh-test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user });
        }
        if (url.pathname === '/auth/v1/user') { verified++; return json(user); }
        return route.abort();
      };
      await context.route('**/*',handler);
      const first = await context.newPage(); currentPage = first; await first.goto(base + '/login');
      await first.getByRole('textbox', { name: 'メールアドレス', exact: true }).fill('callback@example.invalid');
      if (flow === 'signup') {
        await first.getByLabel('パスワード', {exact:true}).fill('synthetic-offline-password');
        for (const box of await first.getByRole('checkbox').all()) await box.check();
        await first.getByRole('button',{name:'新規登録',exact:true}).click();
      } else await first.getByRole('button', { name: 'パスワード再設定', exact: true }).click();
      phase = mode + ':recover';
      await first.getByText(flow === 'signup' ? '確認メールを送信しました' : /パスワード再設定メールを送信しました/).waitFor(); assert.ok(challenge);
      const verifierCookies = (await context.cookies(base)).filter(c => c.name.includes('-code-verifier')); assert.ok(verifierCookies.length);
      if (mode === 'missing-verifier') for (const c of verifierCookies) await context.clearCookies({ name: c.name });
      const second = await context.newPage(); currentPage = second; phase = mode + ':callback';
      if (mode === 'prefetch-then-confirm') {
        const token='SYNTHETIC_PRIVATE_VALUE_1234567890123456';
        const gate=base+'/auth/confirm#'+new URLSearchParams({[flow+'_token']:token});
        const scanner=await browser.newContext();await scanner.route('**/*',handler);
        const preview=await scanner.newPage();await preview.goto(gate);
        await preview.getByRole('button',{name:buttonName,exact:true}).waitFor();
        assert.equal(verificationVisits,0);assert.equal(exchanges,0);await scanner.close();
        await second.goto(gate);await second.getByRole('button',{name:buttonName,exact:true}).waitFor();
        assert.equal(new URL(second.url()).hash,'');assert.equal(new URL(second.url()).search,'');
        assert.equal((await second.locator('body').innerHTML()).includes(token),false);
        assert.equal(await second.locator('a[href*="/auth/v1/verify"]').count(),0);
        for(const width of [320,390,1440]){await second.setViewportSize({width,height:1000});assert.ok(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
        await second.addScriptTag({content:fs.readFileSync('.staging-private/ui-tools/node_modules/axe-core/axe.min.js','utf8')});
        const violations=await second.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(x=>x.id));
        out.confirmationAxeViolations=violations;assert.equal(violations.length,0);
        await second.setViewportSize({width:390,height:844});
        // No screenshot or trace can persist authentication material.
        assert.equal(verificationVisits,0);await second.getByRole('button',{name:buttonName,exact:true}).click();
      } else await second.goto(base + callback);
      if (['new-tab-success','prefetch-then-confirm'].includes(mode)) {
        await second.waitForURL(base + (flow === 'recovery' ? '/auth/reset-password' : '/')); if (flow === 'recovery') await second.getByRole('heading', { name: 'パスワードを再設定', exact: true }).waitFor();
        if (flow === 'recovery') { await second.getByLabel('新しいパスワード', { exact: true }).waitFor(); assert.equal(await second.getByLabel('新しいパスワード', { exact: true }).isEnabled(), true); }
        assert.equal(exchanges, 1); assert.ok(verified > 0 && challengeMatches);
      } else {
        const code = mode === 'missing-verifier' ? 'AUTH-05' : mode === 'mismatch' ? 'AUTH-04' : 'AUTH-02';
        await second.getByText('確認コード：' + code).waitFor(); assert.equal(new URL(second.url()).search, ''); assert.equal(new URL(second.url()).hash, '');
        assert.equal((await second.locator('body').innerText()).includes('SYNTHETIC_PRIVATE_ERROR'), false);
        assert.equal(exchanges, mode === 'missing-verifier' ? 0 : 1);
      }
      if(mode==='prefetch-then-confirm')assert.equal(verificationVisits,1);
      out.checks.push({ name: flow + ':' + mode, pass: true, codeExchanges: exchanges, verificationVisits }); await context.close();
    }
    out.complete = true;
  } catch { out.failure = 'OFFLINE_CALLBACK_BROWSER_FAILED'; out.phase = phase; out.serverErrorCategories = ['OFFLINE_NETWORK_BLOCKED','MODULE_NOT_FOUND','EADDRINUSE','ENOENT','TypeError','ReferenceError','SyntaxError','production build'].filter(x => serverOutput.includes(x)); if (currentPage) out.visibleStatus = (await currentPage.locator('body').innerText().catch(() => '')).match(/AUTH-0[1-9]/)?.[0] || 'NO_STATUS'; process.exitCode = 1; }
  finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null && server.signalCode === null) { server.kill(); await Promise.race([new Promise(r => server.once('exit', r)), pause(5000)]); }
    out.browserClosed = !browser || !browser.isConnected(); out.localServerStopped = !server || server.exitCode !== null || server.signalCode !== null;
    fs.writeFileSync('docs/v2-email-confirmation-browser-result.json', JSON.stringify(out, null, 2) + '\n'); console.log(JSON.stringify(out));
  }
})();
