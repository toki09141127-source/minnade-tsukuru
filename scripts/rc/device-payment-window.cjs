/* eslint-disable @typescript-eslint/no-require-imports -- Bounded, exact-Preview test webhook window; no secret output. */
const fs = require('fs'), assert = require('node:assert/strict'), Stripe = require('stripe');
const proof = 'docs/v2-final-device-payment-window.json';
const stopFile = '.staging-private/v2-final-device-forward.stop';
const lockFile = '.staging-private/v2-final-device-forward.lock';
const cookieFile = '.staging-private/v2rc-preview-access.json';
const expectedPreview = 'https://minnade-tsukuru-staging-jrvv8pum3-sonetokiyas-projects.vercel.app';
const emails = ['minnadetsukuru.auth+rcandroid@gmail.com', 'minnadetsukuru.auth+rciphone@gmail.com'];
if (process.argv.includes('--stop')) {
  if (fs.existsSync(lockFile)) fs.writeFileSync(stopFile, 'stop');
  console.log(JSON.stringify({ stopRequested: fs.existsSync(lockFile) }));
} else {
  (async () => {
    let rt, db, locked = false, stopping = false, interval, endTimer;
    const out = { active: false, preview: expectedPreview, productionChanges: 'NONE', liveBilling: 'OFF',
      customerScope: 'Two designated disposable device accounts only', rawEventsSaved: false, secretsPrinted: false };
    const save = () => fs.writeFileSync(proof, JSON.stringify(out, null, 2) + '\n');
    let finish;
    const finished = new Promise(resolve => { finish = resolve; });
    const stop = async reason => {
      if (stopping) return;
      stopping = true;
      clearInterval(interval); clearTimeout(endTimer);
      out.stopReason = reason;
      try { if (rt) { out.webhooks = { ...rt.counts }; await rt.close(); } }
      finally {
        if (db) await db.end().catch(() => {});
        if (locked) {
          if (fs.existsSync(cookieFile)) fs.unlinkSync(cookieFile);
          if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);
          if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
        }
        out.active = false; out.endedAt = new Date().toISOString();
        out.cookieFileRemoved = !fs.existsSync(cookieFile);
        save(); console.log(JSON.stringify({ active: false, reason, cookieFileRemoved: out.cookieFileRemoved }));
        finish();
      }
    };
    try {
      assert.ok(process.argv.includes('--start'), 'START_REQUIRED');
      const { d, ctx } = require('./preview-scope.cjs').deployment();
      assert.equal(d.url, expectedPreview);
      require('./preview-scope.cjs').access();
      fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' }); locked = true;
      if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);
      const stripe = new Stripe(ctx.env.STRIPE_TEST_SECRET_KEY, { maxNetworkRetries: 0, timeout: 15000 });
      const account = await stripe.accounts.retrieve();
      assert.equal(account.id, 'acct_1USz6gLZaDd1Edb0', 'TEST_ACCOUNT_MISMATCH');
      process.env.LOCALAPPDATA = 'C:/Users/Sonet/AppData/Local';
      db = (await require('../billing/db.cjs')()).db;
      await db.query('SET default_transaction_read_only = on');
      const users = await db.query('SELECT count(*)::int n FROM auth.users WHERE lower(email)=ANY($1::text[]) AND email_confirmed_at IS NOT NULL AND last_sign_in_at IS NOT NULL', [emails]);
      assert.equal(users.rows[0].n, 2, 'BOTH_DEVICE_LOGINS_REQUIRED');
      rt = await require('./preview-listener.cjs')({ allowEvent: async event => {
        const customer = event.data?.object?.customer;
        if (event.livemode !== false || typeof customer !== 'string' || !/^cus_[A-Za-z0-9]+$/.test(customer)) return false;
        const r = await db.query("SELECT EXISTS(SELECT 1 FROM billing_accounts b JOIN auth.users u ON u.id=b.owner_id WHERE b.provider='stripe_test' AND b.customer_id=$1 AND lower(u.email)=ANY($2::text[])) allowed", [customer, emails]);
        return r.rows[0].allowed === true;
      }});
      // A signed unsupported event validates the hosted secret without changing billing state.
      const payload = JSON.stringify({ id: 'evt_device_window_probe', object: 'event', type: 'device.window.probe', livemode: false, created: Math.floor(Date.now()/1000), data: { object: {} } });
      const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: ctx.env.STRIPE_TEST_WEBHOOK_SECRET });
      const probe = await fetch(d.url + '/api/billing/webhook', { method: 'POST', headers: { Cookie: rt.cookie, 'stripe-signature': signature, 'Content-Type': 'application/json' }, body: payload, redirect: 'error', signal: AbortSignal.timeout(20000) });
      assert.equal(probe.status, 200, 'HOSTED_SIGNATURE_PROBE');
      assert.equal((await probe.json()).received, true, 'HOSTED_SIGNATURE_PROBE');
      const expires = Date.parse(require('./preview-scope.cjs').access().expiresAt);
      const duration = Math.min(45 * 60000, expires - Date.now() - 60000);
      assert.ok(duration >= 10 * 60000, 'COOKIE_WINDOW_TOO_SHORT');
      Object.assign(out, { active: true, startedAt: new Date().toISOString(), endsAt: new Date(Date.now()+duration).toISOString(),
        bothDeviceLoginsVerified: true, signedHostedProbe: 'PASS ignored event; no billing mutation', testAccountVerified: true, webhooks: { ...rt.counts } });
      save(); console.log(JSON.stringify({ active: true, endsAt: out.endsAt, signedHostedProbe: 'PASS', scopedCustomers: 2 }));
      interval = setInterval(() => {
        if (fs.existsSync(stopFile)) void stop('requested');
        else { out.webhooks = { ...rt.counts }; save(); }
      }, 5000);
      endTimer = setTimeout(() => void stop('window_expired'), duration);
      process.once('SIGINT', () => void stop('interrupted'));
      process.once('SIGTERM', () => void stop('terminated'));
      await finished;
    } catch {
      process.exitCode = 1;
      await stop('SAFE_WINDOW_SETUP_FAILED');
    }
  })();
}
