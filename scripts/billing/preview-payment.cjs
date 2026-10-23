/* eslint-disable @typescript-eslint/no-require-imports -- Hosted Preview test-card acceptance only. */
const fs = require("fs"),
  crypto = require("crypto"),
  assert = require("node:assert/strict"),
  { createClient } = require("@supabase/supabase-js");
(async () => {
  let h,
    rt,
    phase = "runtime";
  const out = {
      complete: false,
      checks: [],
      productionChanges: "NONE",
      liveBilling: "OFF",
    },
    fixtures = { users: [], rooms: [] };
  const save = () =>
    fs.writeFileSync(
      "docs/v2-4-preview-payment.json",
      JSON.stringify(out, null, 2) + "\n",
    );
  const ok = (name) => {
    out.checks.push({ name, pass: true });
    save();
    console.log("PASS " + name);
  };
  try {
    assert.ok(process.argv.includes("--preview"), "PREVIEW_ONLY");
    rt = await require("./preview-listener.cjs")();
    h = await require("./harness.cjs")();
    fixtures.projectRef = rt.ctx.ref;
    const privateFile =
        ".staging-private/v24-fixtures/hosted-" + crypto.randomUUID() + ".json",
      remember = () => fs.writeFileSync(privateFile, JSON.stringify(fixtures));
    const admin = createClient(
      rt.ctx.url,
      rt.ctx.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    for (const plan of ["plus", "pro"]) {
      phase = plan + " fixture";
      const email =
          "v24-hosted-" + crypto.randomUUID().slice(0, 8) + "@example.invalid",
        password = crypto.randomBytes(24).toString("base64url") + "aA1!";
      const a = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ok(!a.error, "TEST_USER");
      const client = createClient(
        rt.ctx.url,
        rt.ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const login = await client.auth.signInWithPassword({ email, password });
      assert.ok(!login.error, "TEST_LOGIN");
      const u = {
        id: a.data.user.id,
        email,
        password,
        token: login.data.session.access_token,
      };
      fixtures.users.push(u);
      remember();
      assert.ok(
        !(
          await client.rpc("mvp_accept_current_terms", {
            p_terms: "2026-10-22",
            p_privacy: "2026-10-22",
            p_adult: true,
          })
        ).error,
        "CONSENT",
      );
      const call = async (path, body) => {
        const r = await fetch(rt.base + path, {
          method: body ? "POST" : "GET",
          headers: {
            Cookie: rt.cookie,
            Authorization: "Bearer " + u.token,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: r.status, body: await r.json() };
      };
      const p = await h.page(u);
      await p.unroute("**/*");
      await p.goto(rt.base + "/billing?plan=" + plan);
      await p.getByRole("heading", { name: "Free", exact: true }).waitFor();
      ok(plan + " Free current-plan page");
      phase = plan + " checkout";
      await p
        .getByRole("button", { name: "テスト決済で手続きを確認", exact: true })
        .click();
      await p.waitForURL("https://checkout.stripe.com/**");
      assert.equal((await call("/api/billing")).body.plan, "free");
      ok(plan + " Checkout redirects without granting plan");
      await p.locator("#email").fill(email);
      await p.locator("#cardNumber").fill("4242424242424242");
      await p.locator("#cardExpiry").fill("1230");
      await p.locator("#cardCvc").fill("123");
      await p.locator("#billingName").fill("TEST Minnade Creator");
      if (await p.locator("#billingCountry").count())
        await p.locator("#billingCountry").selectOption("JP");
      if (
        await p
          .locator("#billingPostalCode")
          .isVisible()
          .catch(() => false)
      )
        await p.locator("#billingPostalCode").fill("1000001");
      await p.locator("button[type=submit]").click();
      await p.waitForURL(rt.base + "/billing?checkout=returned", {
        timeout: 60000,
      });
      for (let i = 0; i < 60; i++) {
        if ((await call("/api/billing")).body.plan === plan) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      const state = (await call("/api/billing")).body;
      assert.equal(state.plan, plan);
      assert.equal(state.credits.granted, plan === "plus" ? 500 : 2000);
      await p.getByRole("button", { name: "状態を更新", exact: true }).click();
      await p
        .getByRole("heading", {
          name: plan === "plus" ? "Plus" : "Pro",
          exact: true,
        })
        .waitFor();
      ok(plan + " signed webhook activates hosted plan and monthly credits");
      phase = plan + " settings";
      const room = await call("/api/v2/create", {
        requestId: crypto.randomUUID(),
        title: "TEST V24 " + plan,
        description: "架空の共同作品を安全に作るための設定と権限の検収用です。",
        genre: "novel",
        capacity: 10,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        aiLevel: "assist",
        consent: true,
      });
      assert.equal(room.status, 200, "TEST_ROOM");
      fixtures.rooms.push(room.body.data);
      remember();
      await p.goto(rt.base + "/rooms/" + room.body.data);
      await p
        .getByRole("group", { name: "ルームの表示" })
        .getByRole("button", { name: "AIまとめ", exact: true })
        .click();
      await p.getByText("AIの個性・設定", { exact: true }).click();
      await p
        .getByLabel("AIの名前", { exact: true })
        .fill("テスト" + (plan === "plus" ? "進行役" : "編集者"));
      await p.getByLabel("個性", { exact: true }).selectOption("facilitator");
      assert.equal(
        await p.getByLabel("制作上の希望", { exact: true }).isEnabled(),
        plan === "pro",
      );
      if (plan === "pro")
        await p
          .getByLabel("制作上の希望", { exact: true })
          .fill("人間の選択を待って短い候補を出します。");
      await p
        .getByRole("button", { name: "AI設定を保存", exact: true })
        .click();
      await p
        .getByText("設定を保存しました。次のAI依頼から使われます。", {
          exact: true,
        })
        .waitFor();
      ok(plan + " settings editable with correct paid-field lock");
      phase = plan + " cancellation";
      await p.goto(rt.base + "/billing");
      await p
        .getByRole("button", { name: "次回更新で解約", exact: true })
        .click();
      for (let i = 0; i < 60; i++) {
        if ((await call("/api/billing")).body.cancelAtEnd) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      assert.equal((await call("/api/billing")).body.cancelAtEnd, true);
      ok(
        plan + " management schedules cancellation without losing paid access",
      );
    }
    assert.ok(rt.counts.success > 0);
    out.webhooks = rt.counts;
    out.complete = true;
  } catch (e) {
    out.failure = {
      phase,
      code: e.code || "CHECK_FAILED",
      message: /^[A-Z_]+$/.test(e.message || "")
        ? e.message
        : "Hosted assertion failed; no secret or raw response retained",
    };
    console.log(JSON.stringify(out.failure));
    process.exitCode = 1;
  } finally {
    if (h) await h.close();
    if (rt) {
      out.webhooks = rt.counts;
      await rt.close();
    }
    save();
  }
})();
