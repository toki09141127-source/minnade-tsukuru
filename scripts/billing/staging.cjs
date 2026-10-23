/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto"),
  assert = require("node:assert/strict"),
  Stripe = require("stripe"),
  { createClient } = require("@supabase/supabase-js");
(async () => {
  let runtime, browser, db;
  const report = {
    scope:
      "real Supabase staging and real Stripe test API; signed events via official Stripe CLI to local production build",
    checks: [],
    complete: false,
    liveBilling: "OFF",
    productionChanges: "NONE",
  };
  let phase = "runtime";
  const save = () =>
      fs.writeFileSync(
        "docs/v2-4-staging-result.json",
        JSON.stringify(report, null, 2) + "\n",
      ),
    ok = (name) => {
      report.checks.push({ name, pass: true });
      save();
      console.log("PASS " + name);
    };
  const created = [];
  let aiBefore;
  try {
    runtime = await require("./runtime.cjs")();
    const { ctx, base } = runtime;
    db = (await require("./db.cjs")()).db;
    const stripe = new Stripe(ctx.env.STRIPE_TEST_SECRET_KEY, {
        maxNetworkRetries: 1,
        timeout: 20000,
      }),
      admin = createClient(ctx.url, ctx.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const fixture = {
      projectRef: ctx.ref,
      runId: crypto.randomUUID(),
      users: [],
      rooms: [],
      subscriptions: [],
      customers: [],
    };
    const remember = () => {
      fs.mkdirSync(".staging-private/v24-fixtures", { recursive: true });
      fs.writeFileSync(
        ".staging-private/v24-fixtures/" + fixture.runId + ".json",
        JSON.stringify(fixture),
      );
      fs.writeFileSync(
        ".staging-private/v24-e2e.json",
        JSON.stringify(fixture),
      );
    };
    const user = async (label) => {
      const email =
          "v24-" +
          label +
          "-" +
          crypto.randomUUID().slice(0, 8) +
          "@example.invalid",
        password = crypto.randomBytes(24).toString("base64url") + "aA1!";
      const createdUser = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ok(!createdUser.error, "TEST_USER");
      const client = createClient(
        ctx.url,
        ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const logged = await client.auth.signInWithPassword({ email, password });
      assert.ok(!logged.error, "TEST_LOGIN");
      const f = {
        id: createdUser.data.user.id,
        email,
        password,
        token: logged.data.session.access_token,
      };
      fixture.users.push(f);
      remember();
      const consent = await client.rpc("mvp_accept_current_terms", {
        p_terms: "2026-10-22",
        p_privacy: "2026-10-22",
        p_adult: true,
      });
      assert.ok(!consent.error, "TEST_CONSENT");
      return { ...f, client };
    };
    const call = async (u, path, body) => {
      const r = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: "Bearer " + u.token,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await r.json();
      return { status: r.status, body: result };
    };
    const billing = async (u) => (await call(u, "/api/billing")).body;
    const wait = async (fn, label, limit = 60) => {
      for (let i = 0; i < limit; i++) {
        const value = await fn();
        if (value) return value;
        await new Promise((r) => setTimeout(r, 1000));
      }
      throw Error(label);
    };
    const creator = await user("creator"),
      core = await user("core"),
      member = await user("member");
    ok("Synthetic staging users authenticated with current consent");
    phase = "checkout";
    let r = await call(creator, "/api/billing", {
      action: "checkout",
      requestId: crypto.randomUUID(),
      plan: "plus",
      cycle: "month",
    });
    assert.equal(r.status, 200, "CHECKOUT_CREATE");
    assert.match(r.body.url, /^https:\/\/checkout.stripe.com\//);
    ok("App creates real Stripe test Checkout");
    fixture.checkoutUrl = r.body.url;
    remember();
    assert.equal((await billing(creator)).plan, "free");
    ok("Checkout creation and return do not activate subscription");
    const a = (
      await db.query(
        "SELECT id,customer_id FROM billing_accounts WHERE owner_id=$1",
        [creator.id],
      )
    ).rows[0];
    fixture.customers.push(a.customer_id);
    remember();
    created.push(a.customer_id);
    // Browser exercises the provider's test Checkout; only published Stripe test card and synthetic identity.
    const { chromium } = require(
      path.join(ctx.env.MVP_TEST_RUNTIME, "node_modules/playwright-core"),
    );
    browser = await chromium.launch({
      headless: true,
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    });
    const checkout = await browser.newPage();
    await checkout.goto(r.body.url, { waitUntil: "domcontentloaded" });
    let checkoutCompleted = false;
    try {
      await checkout.locator("#email").fill(creator.email, { timeout: 15000 });
      await checkout.locator("#cardNumber").fill("4242424242424242");
      await checkout.locator("#cardExpiry").fill("1230");
      await checkout.locator("#cardCvc").fill("123");
      await checkout.locator("#billingName").fill("TEST Minnade Creator");
      if (await checkout.locator("#billingCountry").count())
        await checkout.locator("#billingCountry").selectOption("JP");
      if (
        await checkout
          .locator("#billingPostalCode")
          .isVisible()
          .catch(() => false)
      )
        await checkout.locator("#billingPostalCode").fill("1000001");
      await checkout.locator('button[type="submit"]').click();
      await checkout.waitForURL(base + "/billing?checkout=returned", {
        timeout: 45000,
      });
      checkoutCompleted = true;
    } catch {
      report.checkoutBrowser = "UNVERIFIED";
    }
    if (checkoutCompleted) {
      report.checkoutBrowser = "PASS";
      ok("Stripe test Checkout completed through browser");
    } else {
      // Independent real API lifecycle can proceed, but never label Checkout browser completion PASS.
      const open = await stripe.checkout.sessions.list({
        customer: a.customer_id,
        status: "open",
        limit: 10,
      });
      for (const s of open.data) await stripe.checkout.sessions.expire(s.id);
      const pm = await stripe.paymentMethods.attach("pm_card_visa", {
        customer: a.customer_id,
      });
      await stripe.customers.update(a.customer_id, {
        invoice_settings: { default_payment_method: pm.id },
      });
      const sub = await stripe.subscriptions.create({
        customer: a.customer_id,
        items: [{ price: ctx.env.STRIPE_TEST_PRICE_PLUS_MONTH }],
        metadata: { minnade_account: a.id },
      });
      assert.equal(sub.livemode, false);
      fixture.subscriptions.push(sub.id);
      remember();
    }
    phase = "webhook activation";
    await wait(
      async () => (await billing(creator)).plan === "plus",
      "PLUS_WEBHOOK",
    );
    ok("Actual Stripe-signed webhook activates Plus in staging");
    const plus = await billing(creator);
    assert.equal(plus.credits.granted, 500);
    ok("Plus monthly grant from authoritative webhook");
    phase = "upgrade";
    r = await call(creator, "/api/billing", {
      action: "change",
      requestId: crypto.randomUUID(),
      plan: "pro",
      cycle: "month",
    });
    assert.equal(r.status, 200, "UPGRADE");
    await wait(
      async () => (await billing(creator)).plan === "pro",
      "PRO_WEBHOOK",
    );
    assert.equal((await billing(creator)).credits.granted, 2000);
    ok("Paid immediate upgrade activates Pro and tops up credits");
    phase = "profiles";
    const profileId = crypto.randomUUID(),
      preferences = {
        name: "TEST Custom Creator",
        profile: "架空の共同作品を短い提案で支えます。",
        specialties: ["story", "editing"],
        sliders: [2, 2, 2, 2, 2],
        instructions: "人間が決めるための候補を短く整理してください。",
      };
    r = await call(creator, "/api/billing", {
      action: "profile",
      id: profileId,
      version: 0,
      name: "TEST reusable AI",
      settings: preferences,
    });
    assert.equal(r.status, 200, "PROFILE_SAVE");
    ok("Pro saved profile persisted through authenticated API");
    phase = "room and credits";
    aiBefore = (await db.query("SELECT enabled FROM mvp_private.ai_control"))
      .rows[0].enabled;
    await db.query("SELECT v22_ai_control(true)");
    r = await call(creator, "/api/v2/create", {
      requestId: crypto.randomUUID(),
      title: "TEST V24 collaboration",
      description:
        "架空の仲間が共同で物語を作りながらAIの権限と利用枠を確認します。",
      genre: "novel",
      capacity: 10,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      aiLevel: "assist",
      consent: true,
      profileId,
    });
    assert.equal(r.status, 200, "ROOM");
    const room = r.body.data;
    fixture.rooms.push(room);
    remember();
    for (const u of [core, member])
      assert.equal(
        (
          await call(u, "/api/v2/member", {
            roomId: room,
            action: "join",
            consent: "2026-10-22-v2.1",
          })
        ).status,
        200,
      );
    const cr = await call(core, "/api/v2/member", {
      roomId: room,
      action: "apply_core",
      consent: "2026-10-22-v2.1",
    });
    assert.equal(
      (
        await call(creator, "/api/v2/member", {
          roomId: room,
          action: "approve_core",
          requestId: cr.body.data.requestId,
        })
      ).status,
      200,
    );
    await wait(async () => {
      await call(creator, "/api/v2/ai?roomId=" + room);
      const t = (
        await db.query(
          "SELECT status FROM room_ai_tasks WHERE room_id=$1 AND trigger_type='greeting'",
          [room],
        )
      ).rows[0];
      return t?.status === "succeeded";
    }, "GREETING");
    assert.equal((await billing(creator)).credits.consumed, 0);
    ok("Automatic greeting consumes zero user credits");
    assert.equal(
      (
        await call(core, "/api/billing", {
          action: "settings",
          roomId: room,
          settings: { name: "TEST denied" },
        })
      ).status,
      409,
    );
    ok("Core cannot edit Creator AI settings");
    assert.equal(
      (
        await call(member, "/api/v2/ai", {
          roomId: room,
          requestId: crypto.randomUUID(),
          kind: "question",
          text: "TEST",
        })
      ).status,
      403,
    );
    ok("Member cannot charge Creator");
    const before = (await billing(creator)).credits.consumed;
    r = await call(core, "/api/v2/ai", {
      roomId: room,
      requestId: crypto.randomUUID(),
      kind: "summarize",
      taskClass: "minutes",
      text: "提案をまとめてください。",
    });
    assert.equal(r.status, 202, "CORE_MANUAL");
    const taskId = r.body.taskId;
    await wait(async () => {
      await call(creator, "/api/v2/ai?roomId=" + room);
      return (
        (
          await db.query("SELECT status FROM room_ai_tasks WHERE id=$1", [
            taskId,
          ])
        ).rows[0]?.status === "succeeded"
      );
    }, "CREDIT_SUCCESS");
    assert.equal((await billing(creator)).credits.consumed, before + 5);
    assert.equal((await billing(core)).credits.consumed, 0);
    ok("Synthetic AI completion settles Creator credits for Core request");
    phase = "cancel resume";
    r = await call(creator, "/api/billing", {
      action: "cancel",
      requestId: crypto.randomUUID(),
    });
    assert.equal(r.status, 200, "CANCEL");
    await wait(
      async () => (await billing(creator)).cancelAtEnd,
      "CANCEL_WEBHOOK",
    );
    assert.equal((await billing(creator)).plan, "pro");
    ok("Cancel schedules end while current Pro remains");
    r = await call(creator, "/api/billing", {
      action: "resume",
      requestId: crypto.randomUUID(),
    });
    assert.equal(r.status, 200);
    await wait(
      async () => !(await billing(creator)).cancelAtEnd,
      "RESUME_WEBHOOK",
    );
    ok("Cancel reservation can be reversed");
    phase = "scheduled downgrade";
    r = await call(creator, "/api/billing", {
      action: "change",
      requestId: crypto.randomUUID(),
      plan: "plus",
      cycle: "year",
    });
    assert.equal(r.status, 200, "SCHEDULE");
    await wait(
      async () => (await billing(creator)).nextPlan === "plus",
      "SCHEDULE_WEBHOOK",
    );
    ok("Downgrade and yearly switch scheduled while current Pro retained");
    phase = "portal";
    r = await call(creator, "/api/billing", {
      action: "portal",
      requestId: crypto.randomUUID(),
    });
    assert.equal(r.status, 200);
    assert.match(r.body.url, /^https:\/\/billing.stripe.com\//);
    ok("Restricted real test Billing Portal created");
    fixture.ready = true;
    remember();
    report.complete = true;
    report.actualStripeWebhook = true;
  } catch (e) {
    report.failure = {
      phase,
      code: e.code ?? e.type ?? "CHECK_FAILED",
      message: /^[A-Z0-9_]+$/.test(e.message ?? "")
        ? e.message
        : "Verification failed; no raw provider response retained",
    };
    process.exitCode = 1;
    console.log(JSON.stringify(report.failure));
  } finally {
    if (db && aiBefore !== undefined)
      await db.query("SELECT v22_ai_control($1)", [aiBefore]).catch(() => {});
    if (browser) await browser.close();
    if (runtime) await runtime.close();
    if (db) await db.end();
    save();
  }
})();
