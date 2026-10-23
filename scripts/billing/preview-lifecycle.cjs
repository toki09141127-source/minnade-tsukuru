/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs"),
  crypto = require("crypto"),
  assert = require("node:assert/strict"),
  Stripe = require("stripe"),
  { createClient } = require("@supabase/supabase-js");
(async () => {
  let runtime, db, h;
  let phase = "runtime";
  const report = {
    scope:
      process.argv.includes("--preview") ? "real Stripe test clocks + signed webhook to approved Hosted Preview; synthetic users only" : "real Stripe test clocks + signed webhook to fixed localhost build; real staging synthetic users only",
    checks: [],
    complete: false,
    productionChanges: "NONE",
    liveBilling: "OFF",
  };
  const save = () =>
      fs.writeFileSync(
        process.argv.includes("--preview") ? "docs/v2-4-preview-lifecycle.json" : "docs/v2-4-schedule-recovery-lifecycle.json",
        JSON.stringify(report, null, 2) + "\n",
      ),
    ok = (name) => {
      report.checks.push({ name, pass: true });
      save();
      console.log("PASS " + name);
    };
  try {
    runtime = await require(process.argv.includes("--preview") ? "./preview-listener.cjs" : "./runtime.cjs")();
    h = await require("./harness.cjs")();
    const { ctx, base } = runtime;
    db = (await require("./db.cjs")()).db;
    const stripe = new Stripe(ctx.env.STRIPE_TEST_SECRET_KEY, {
        maxNetworkRetries: 1,
        timeout: 20000,
      }),
      admin = createClient(ctx.url, ctx.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const fixtures = process.argv.includes("--resume") ? JSON.parse(fs.readFileSync(".staging-private/v24-hosted-clock-e2e.json")) : {
        projectRef: ctx.ref,
        runId: crypto.randomUUID(),
        users: [],
      },
      remember = () => {
        fs.mkdirSync(".staging-private/v24-fixtures", { recursive: true });
        fs.writeFileSync(
          ".staging-private/v24-fixtures/hosted-clocks-" + fixtures.runId + ".json",
          JSON.stringify(fixtures),
        );
        fs.writeFileSync(
          ".staging-private/v24-hosted-clock-e2e.json",
          JSON.stringify(fixtures),
        );
      };
    const wait = async (fn, label, limit = 90) => {
      for (let i = 0; i < limit; i++) {
        const r = await fn();
        if (r) return r;
        await new Promise((r) => setTimeout(r, 1000));
      }
      throw Error(label);
    };
    const call = async (u, body, path="/api/billing") => {
      const r = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Cookie: runtime.cookie,
          Authorization: "Bearer " + u.token,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
    const state = async (u) => (await call(u)).body;
    let fixtureIndex=0;
    const create = async (plan) => {
      const prior=fixtures.users[fixtureIndex++];
      if(prior){const client=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const login=await client.auth.signInWithPassword({email:prior.email,password:prior.password});assert.ok(!login.error);prior.token=login.data.session.access_token;remember();return prior;}
      const email =
          "v24-clock-" + crypto.randomUUID().slice(0, 8) + "@example.invalid",
        password = crypto.randomBytes(24).toString("base64url") + "aA1!";
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ok(!created.error, "TEST_USER");
      const client = createClient(
        ctx.url,
        ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const logged = await client.auth.signInWithPassword({ email, password });
      assert.ok(!logged.error);
      assert.ok(
        !(
          await client.rpc("mvp_accept_current_terms", {
            p_terms: "2026-10-22",
            p_privacy: "2026-10-22",
            p_adult: true,
          })
        ).error,
      );
      const u = {
        id: created.data.user.id,
        email,
        password,
        token: logged.data.session.access_token,
      };
      fixtures.users.push(u);
      remember();
      const request = crypto.randomUUID(),
        hash = crypto
          .createHash("sha256")
          .update(JSON.stringify({ action: "checkout", plan, cycle: "month" }))
          .digest("hex");
      const intent = await client.rpc("v24_billing_start", {
        p_request: request,
        p_kind: "checkout",
        p_hash: hash,
        p_plan: plan,
        p_cycle: "month",
      });
      assert.ok(!intent.error, "INTENT");
      u.account = intent.data;
      const clock = await stripe.testHelpers.testClocks.create({
        frozen_time: Math.floor(Date.now() / 1000),
        name: "TEST Minnade V24",
      });
      const customer = await stripe.customers.create({
        test_clock: clock.id,
        metadata: { minnade_account: u.account },
      });
      assert.equal(customer.livemode, false);
      u.customer = customer.id;
      u.clock = clock.id;
      const pm = await stripe.paymentMethods.attach("pm_card_visa", {
        customer: customer.id,
      });
      u.paymentMethod = pm.id;
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: pm.id },
      });
      assert.ok(
        !(
          await admin.rpc("v24_customer_bind", {
            p_request: request,
            p_provider: "stripe_test",
            p_customer: customer.id,
          })
        ).error,
      );
      assert.ok(
        !(
          await admin.rpc("v24_operation_finish", {
            p_request: request,
            p_ref: null,
            p_url: null,
          })
        ).error,
      );
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price:
              ctx.env["STRIPE_TEST_PRICE_" + plan.toUpperCase() + "_MONTH"],
          },
        ],
        metadata: { minnade_account: u.account },
      });
      assert.equal(sub.livemode, false);
      u.subscription = sub.id;
      remember();
      await wait(
        async () => (await state(u)).plan === plan,
        "CLOCK_INITIAL_WEBHOOK",
      );
      return u;
    };
    const advance = async (u) => {
      const sub = await stripe.subscriptions.retrieve(u.subscription),
        end = sub.items.data[0].current_period_end;
      await stripe.testHelpers.testClocks.advance(u.clock, {
        frozen_time: end + 7200,
      });
      await wait(
        async () =>
          (await stripe.testHelpers.testClocks.retrieve(u.clock)).status ===
          "ready",
        "CLOCK_READY",
      );
      return end;
    };
    phase = "downgrade clock";
    const a = await create("pro");
    ok("Test-clock Pro activated by signed Hosted webhook");
    const p=await h.page(a);await p.unroute("**/*");await p.goto(base+'/billing');await p.getByRole('heading',{name:'Pro',exact:true}).waitFor();
    const profileId=a.profileId || (await state(a)).profiles[0]?.id || crypto.randomUUID(),preferences={name:'TEST preserved editor',profile:'架空の作品を支える編集者です。',sliders:[2,2,2,2,2],instructions:'人間の選択を待って候補を整理します。'};
    assert.equal((await call(a,{action:'profile',id:profileId,version:(await state(a)).profiles[0]?.version||0,name:'TEST retained profile',settings:preferences})).status,200);
    const createRoom=async(profileId)=>{const r=await call(a,{requestId:crypto.randomUUID(),title:'TEST V24 lifecycle',description:'架空の共同作品のプラン変更と保持状態を検証する専用ルームです。',genre:'novel',capacity:10,deadline:new Date(Date.now()+86400000).toISOString(),aiLevel:'assist',consent:true,...(profileId?{profileId}:{})},'/api/v2/create');assert.equal(r.status,200,'TEST_ROOM');return r.body.data;};
    a.profileId=profileId;remember();
    const knownRoom=(await db.query("SELECT room_id FROM room_ai_entitlements WHERE account_id=$1 ORDER BY room_id LIMIT 1",[a.account])).rows[0]?.room_id;
    const room=a.room || knownRoom || await createRoom(profileId),roomState=async(id)=>(await call(a,undefined,'/api/billing?roomId='+id)).body;
    a.room=room;remember();assert.equal((await roomState(room)).plan,'pro');assert.equal((await roomState(room)).settings.name,preferences.name);
    ok('Hosted Pro saved profile reused in new room');
    let r = await call(a, {
      action: "change",
      requestId: (await state(a)).pendingOperation?.id || crypto.randomUUID(),
      plan: "plus",
      cycle: "month",
    });
    assert.equal(r.status, 200, "SCHEDULE_"+(r.body.code||r.status));
    await wait(
      async () => (await state(a)).nextPlan === "plus",
      "SCHEDULE_STATE",
    );
    assert.equal((await state(a)).plan, "pro");
    await p.reload();await p.getByText('次の更新から Plus / 月払い に変更予定です。',{exact:true}).waitFor();
    ok("Before renewal downgrade retains Pro and Hosted scheduled-change UI");
    await advance(a);
    await wait(
      async () =>
        (await state(a)).plan === "plus" &&
        (await state(a)).status === "active",
      "DOWNGRADE_RENEWAL",
    );
    assert.equal((await state(a)).credits.granted, 500);
    ok("Clock renewal switches Pro to Plus with next-period allowance");
    await p.reload();await p.getByRole('heading',{name:'Plus',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'編集',exact:true}).count(),0);await p.getByRole('button',{name:'設定を見る',exact:true}).first().click();assert.equal(await p.getByRole('button',{name:'保存する',exact:true}).isEnabled(),false);
    assert.equal((await state(a)).profiles[0].settings.name,preferences.name);assert.equal((await roomState(room)).plan,'pro');
    const plusRoom=await createRoom();assert.equal((await roomState(plusRoom)).plan,'plus');
    ok('Hosted downgrade locks retained profile; old room stays Pro, new room Plus');
    assert.equal((await call(a,{action:"resume",requestId:crypto.randomUUID()})).status,200);
    assert.equal((await call(a,{action:'change',requestId:crypto.randomUUID(),plan:'pro',cycle:'month'})).status,200);
    await wait(async()=>(await state(a)).plan==='pro','RESTORED_PRO');await p.reload();await p.getByRole('heading',{name:'Pro',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'編集',exact:true}).first().isEnabled(),true);
    assert.equal((await state(a)).profiles[0].settings.name,preferences.name);assert.equal((await state(a)).credits.granted,2000);
    ok('Hosted paid upgrade restores retained profile and Pro credit allowance');
    phase = "cancel clock";
    r = await call(a, { action: "cancel", requestId: crypto.randomUUID() });
    assert.equal(r.status, 200, "CANCEL");
    await wait(async () => (await state(a)).cancelAtEnd, "CANCEL_STATE");
    assert.equal((await state(a)).plan, "pro");
    await advance(a);
    await wait(async () => (await state(a)).plan === "free", "CANCEL_END");
    ok("Cancellation at actual test-clock renewal becomes Free");
    await p.reload();await p.getByRole('heading',{name:'Free',exact:true}).waitFor();assert.equal((await roomState(room)).plan,'pro');const freeRoom=await createRoom();assert.equal((await roomState(freeRoom)).plan,'free');
    ok('Hosted cancellation retains active-room snapshot; new room is Free');
    phase = "payment failure";
    const b = await create("plus");
    const fail = await stripe.paymentMethods.attach(
      "pm_card_chargeCustomerFail",
      { customer: b.customer },
    );
    await stripe.customers.update(b.customer, {
      invoice_settings: { default_payment_method: fail.id },
    });
    await advance(b);
    await wait(async () => (await state(b)).status === "grace", "GRACE_STATE");
    const grace = await state(b);
    assert.equal(grace.plan, "plus");
    assert.equal(grace.credits.granted, 0);
    assert.ok(
      Date.parse(grace.graceUntil) <= Date.now() + 3 * 86400000 + 10000,
    );
    ok("Actual failed renewal enters three-day grace without new credit grant");
    const gracePage=await h.page(b);await gracePage.unroute("**/*");await gracePage.goto(base+'/billing');await gracePage.getByText(/支払い確認中です。猶予期限/).waitFor();await gracePage.addScriptTag({content:fs.readFileSync('.staging-private/ui-tools/node_modules/axe-core/axe.min.js','utf8')});assert.equal(await gracePage.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.length),0);
    ok('Hosted actual payment-failure grace UI and axe A/AA');
    phase = "payment recovery";
    await stripe.customers.update(b.customer, {
      invoice_settings: { default_payment_method: b.paymentMethod },
    });
    const sub = await stripe.subscriptions.retrieve(b.subscription);
    assert.equal(typeof sub.latest_invoice, "string");
    await stripe.invoices.pay(sub.latest_invoice, {
      payment_method: b.paymentMethod,
    });
    await wait(
      async () => (await state(b)).status === "active",
      "RECOVERY_STATE",
    );
    assert.equal((await state(b)).credits.granted, 500);
    ok("Paid retry restores active Plus and grants the period once");
    phase = "yearly switch";
    r = await call(b, {
      action: "change",
      requestId: crypto.randomUUID(),
      plan: "plus",
      cycle: "year",
    });
    assert.equal(r.status, 200, "YEAR_SCHEDULE");
    await wait(
      async () => (await state(b)).nextCycle === "year",
      "YEAR_SCHEDULE_STATE",
    );
    assert.equal((await state(b)).cycle, "month");
    await advance(b);
    await wait(
      async () =>
        (await state(b)).cycle === "year" &&
        (await state(b)).status === "active",
      "YEAR_SWITCH",
    );
    ok("Monthly-to-yearly change occurs only at test-clock renewal");
    phase = "billing retirement";
    const job = (
      await db.query(
        "INSERT INTO account_deletion_jobs(actor_id,attribution,policy_version,lease_token,lease_until) VALUES($1,'anonymous','withdrawal-draft-2026-10-21',gen_random_uuid(),now()+interval '5 minutes') RETURNING id,lease_token",
        [b.id],
      )
    ).rows[0];
    Object.assign(process.env, ctx.env, {
      V2_ENABLED: "true",
      BILLING_ENABLED: "true",
      BILLING_PROVIDER: "stripe_test",
      VERCEL_ENV: "development",
    });
    delete process.env.VERCEL;
    const { prepareBillingDeletion } = require("./load.cjs")(
      "lib/billing/deletion.ts",
    );
    await prepareBillingDeletion(admin, {
      id: job.id,
      actorId: b.id,
      lease: job.lease_token,
      stage: "requested",
    });
    const canceled = await stripe.subscriptions.retrieve(b.subscription);
    assert.equal(canceled.status, "canceled");
    assert.ok(
      (
        await db.query(
          "SELECT deletion_confirmed FROM billing_accounts WHERE id=$1",
          [b.account],
        )
      ).rows[0].deletion_confirmed,
    );
    ok(
      "Deletion preparation cancels actual test subscription before Auth deletion",
    );
    await prepareBillingDeletion(admin, {
      id: job.id,
      actorId: b.id,
      lease: job.lease_token,
      stage: "requested",
    });
    ok("Repeated billing retirement is idempotent");
    assert.ok((await admin.auth.admin.getUserById(b.id)).data.user);
    ok(
      "Billing retirement does not delete Auth or bypass existing deletion workflow",
    );
    await wait(
      async () =>
        (
          await db.query(
            "SELECT count(*)::int n FROM billing_events WHERE account_id=$1 AND status='quarantined'",
            [b.account],
          )
        ).rows[0].n > 0,
      "RETIRE_EVENT",
    );
    ok("Retirement webhook quarantined instead of reactivating account");
    assert.equal(h.errors.length,0);assert.equal(h.http500.length,0);report.webhooks=runtime.counts;report.complete = true;
  } catch (e) {
    report.failure = {
      phase,
      code: e.code ?? e.type ?? "CHECK_FAILED",
      message: /^[A-Z0-9_]+$/.test(e.message ?? "")
        ? e.message
        : "Verification failed; provider details omitted",
    };
    process.exitCode = 1;
    console.log(JSON.stringify(report.failure));
  } finally {
    if (h) await h.close();
    if (runtime) await runtime.close();
    if (db) await db.end();
    save();
  }
})();
