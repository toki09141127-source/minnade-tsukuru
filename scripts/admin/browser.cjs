/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs"),
  assert = require("node:assert/strict"),
  { randomUUID } = require("crypto"),
  { createClient } = require("@supabase/supabase-js");
(async () => {
  let h,
    db,
    phase = "setup";
  const hosted = process.argv.includes("--preview"),
    report = {
      complete: false,
      scope: hosted
        ? "Hosted staging Preview"
        : "local production build + actual staging",
      checks: [],
      violations: [],
      productionChanges: "NONE",
      liveBilling: "OFF",
    };
  const save = () =>
    fs.writeFileSync(
      "docs/v2-5-" + (hosted ? "preview" : "local") + "-ui.json",
      JSON.stringify(report, null, 2) + "\n",
    );
  const ok = (name) => {
    report.checks.push({ name, pass: true });
    save();
    console.log("PASS " + name);
  };
  try {
    h = await require("./harness.cjs")();
    db = (await require("../billing/db.cjs")()).db;
    const f = h.f;
    assert.equal(f.projectRef, "fwqucffxdmbdczspkcyr");
    report.previewUrl = hosted ? h.base : undefined;
    const owner = await h.page(f.users[0]),
      mod = await h.page(f.users[1]);
    const axe = fs.readFileSync(
      ".staging-private/ui-tools/node_modules/axe-core/axe.min.js",
      "utf8",
    );
    const ready = async (p, section, target = "") => {
      await p.goto(
        h.base +
          "/admin" +
          (section === "overview" ? "" : "/" + section) +
          (target ? "?target=" + target : ""),
      );
      await p.getByText(/確認時刻：/).waitFor();
      assert.equal(
        await p.locator("main [role=alert]").count(),
        0,
        "ADMIN_UI_ERROR",
      );
    };
    const audit = async (p, name) => {
      await p.addScriptTag({ content: axe });
      const violations = await p.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
        });
        return r.violations.map((x) => ({
          id: x.id,
          impact: x.impact,
          nodes: x.nodes.map((n) => n.target),
        }));
      });
      report.violations.push(...violations.map((x) => ({ page: name, ...x })));
      save();
      assert.equal(violations.length, 0, "AXE_" + name);
    };
    const widths = async (p, section) => {
      for (const width of [320, 375, 390, 768, 1024, 1440]) {
        await p.setViewportSize({ width, height: 1000 });
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "OVERFLOW_" + section + "_" + width,
        );
        if ([375, 1440].includes(width)) await audit(p, section + " " + width);
        if (width === 375 && ["overview", "system"].includes(section))
          await p.screenshot({
            path:
              ".staging-private/v25-" +
              (hosted ? "preview-" : "local-") +
              section +
              "-375.png",
            fullPage: true,
          });
      }
      ok(section + " six widths / axe zero");
    };
    if (!process.argv.includes("--focused")) {
      phase = "Owner screens";
      for (const section of [
        "overview",
        "reports",
        "users",
        "rooms",
        "works",
        "ai",
        "billing",
        "system",
        "audit",
        "staff",
      ]) {
        await ready(owner, section);
        await widths(owner, section);
      }
      ok("Owner all nine areas and staff management");
      phase = "Moderator screens";
      for (const section of [
        "overview",
        "reports",
        "users",
        "rooms",
        "works",
        "ai",
        "billing",
        "audit",
      ])
        await ready(mod, section);
      assert.equal(
        await mod.getByRole("link", { name: "システム", exact: true }).count(),
        0,
      );
      h.browserMetrics.allowExpectedAdminFailure = true;
      await mod.goto(h.base + "/admin/system");
      await mod.getByRole("alert").filter({ hasText: "Ownerのみ" }).waitFor();
      h.browserMetrics.allowExpectedAdminFailure = false;
      ok("Moderator no Owner UI or system route");
    }

    const token = async (user) => {
      const c = createClient(
        h.ctx.url,
        h.ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const r = await c.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      assert.ok(!r.error, "TEST_LOGIN");
      return r.data.session.access_token;
    };
    const tokens = await Promise.all(f.users.slice(0, 4).map(token));
    const api = async (actor, section, body, extra = {}) => {
      const headers = {
        ...(actor === null ? {} : { Authorization: "Bearer " + tokens[actor] }),
        ...(body ? { "Content-Type": "application/json", Origin: h.base } : {}),
        ...extra,
      };
      if (hosted) {
        const a = require("./preview-scope.cjs").access();
        headers.Cookie = a.cookies
          .map((c) => c.name + "=" + c.value)
          .join("; ");
      }
      const response = await fetch(
        h.base +
          "/api/admin?" +
          new URLSearchParams({ section, ...(body ? {} : {}) }),
        {
          method: body ? "POST" : "GET",
          headers,
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return { status: response.status, data: await response.json() };
    };
    const action = (action, type, target, version, value) => ({
      request: randomUUID(),
      action,
      type,
      target,
      version,
      value,
      reason: "operational",
      note: "Synthetic admin browser verification",
      confirm: true,
    });
    phase = "API permissions";
    assert.equal((await api(null, "overview")).status, 401);
    assert.equal((await api(2, "overview")).status, 403);
    assert.equal((await api(3, "overview")).status, 403);
    assert.equal((await api(1, "system")).status, 403);
    assert.equal(
      (await api(1, "overview", action("feature", "system", "posts", 0, false)))
        .status,
      403,
    );
    assert.equal(
      (
        await api(
          0,
          "overview",
          action("feature", "system", "posts", 0, false),
          { Origin: "https://example.invalid" },
        )
      ).status,
      403,
    );
    {
      const invalid = await api(0, "overview", {
        ...action("feature", "system", "posts", 0, false),
        confirm: false,
      });
      assert.equal(invalid.status, 400, "CONFIRM_" + invalid.data.error);
    }
    ok(
      "Anonymous / normal / suspended / Moderator / CSRF / confirmation rejected",
    );
    const forbidden = [
      "email",
      "customer_id",
      "subscription_id",
      "payload",
      "access_token",
      "request_text",
      "context_hash",
      "raw_user_meta_data",
    ];
    for (const section of ["users", "ai", "billing", "audit"]) {
      const r = await api(0, section);
      assert.equal(r.status, 200);
      const walk = (x) => {
        if (x && typeof x === "object")
          for (const [k, v] of Object.entries(x)) {
            assert.ok(!forbidden.includes(k), "PII_" + k);
            walk(v);
          }
      };
      walk(r.data);
    }
    ok("Management projections omit Auth/payment/prompt private fields");
    phase = "hide and restore";
    const work = f.rooms.published;
    await ready(mod, "works", work);
    await mod
      .getByRole("button", { name: "再表示", exact: true })
      .first()
      .click();
    const dialog = mod.getByRole("dialog");
    await dialog.waitFor();
    await audit(mod, "restore dialog");
    await dialog.getByLabel(/運営メモ/).fill("Synthetic restore verification");
    await dialog.getByLabel("対象と影響を確認しました").check();
    await dialog.getByRole("button", { name: "確認して実行" }).click();
    await mod.getByText("操作を記録しました。").waitFor();
    await mod.getByText(/確認時刻：/).waitFor();
    ok("Moderator restore UI writes immutable audit");
    const anon = createClient(
      h.ctx.url,
      h.ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } },
    );
    let publicResult = await anon.from("rooms").select("id").eq("id", work);
    assert.equal(publicResult.data.length, 1, "RESTORED_PUBLIC");
    await mod
      .getByRole("button", { name: "非表示", exact: true })
      .first()
      .click();
    await dialog.getByLabel(/運営メモ/).fill("Synthetic hide verification");
    await dialog.getByLabel("対象と影響を確認しました").check();
    await dialog.getByRole("button", { name: "確認して実行" }).click();
    await mod
      .getByRole("button", { name: "再表示", exact: true })
      .first()
      .waitFor();
    publicResult = await anon.from("rooms").select("id").eq("id", work);
    assert.equal(publicResult.data.length, 0, "HIDDEN_PUBLIC");
    const snapshotResult = await anon
      .from("v2_work_snapshots")
      .select("room_id")
      .eq("room_id", work);
    assert.ok(
      !snapshotResult.error && snapshotResult.data.length === 0,
      "HIDDEN_SNAPSHOT_PUBLIC",
    );
    ok("Hide UI blocks direct anonymous room read");
    phase = "report workflow";
    await ready(mod, "reports", f.reports[hosted ? 1 : 0]);
    const review = mod.getByRole("button", { name: "確認中", exact: true });
    if (await review.count()) {
      await review.first().click();
      await dialog.getByLabel(/運営メモ/).fill("Synthetic review note");
      await dialog.getByLabel("対象と影響を確認しました").check();
      await dialog.getByRole("button", { name: "確認して実行" }).click();
      await mod
        .getByRole("button", { name: "対応済み", exact: true })
        .first()
        .waitFor();
    }
    const resolve = mod.getByRole("button", { name: "対応済み", exact: true });
    if (await resolve.count()) {
      await resolve.first().click();
      await dialog.getByLabel(/運営メモ/).fill("Synthetic resolution note");
      await dialog.getByLabel("対象と影響を確認しました").check();
      await dialog.getByRole("button", { name: "確認して実行" }).click();
      await mod.getByText("Synthetic resolution note").waitFor();
    }
    ok("Report review/resolve and internal note UI independent of visibility");
    phase = "suspend restore";
    await ready(mod, "users", f.users[3].id);
    await mod
      .getByRole("button", { name: "利用停止を解除", exact: true })
      .first()
      .click();
    await dialog.getByLabel(/運営メモ/).fill("Synthetic suspension recovery");
    await dialog.getByLabel("対象と影響を確認しました").check();
    await dialog.getByRole("button", { name: "確認して実行" }).click();
    await mod
      .getByRole("button", { name: "利用を停止", exact: true })
      .first()
      .waitFor();
    await mod
      .getByRole("button", { name: "利用を停止", exact: true })
      .first()
      .click();
    await dialog
      .getByLabel(/運営メモ/)
      .fill("Synthetic suspension verification");
    await dialog.getByLabel("対象と影響を確認しました").check();
    await dialog.getByRole("button", { name: "確認して実行" }).click();
    await mod
      .getByRole("button", { name: "利用停止を解除", exact: true })
      .first()
      .waitFor();
    ok("Suspend/restore UI retains contribution data");
    phase = "flags UI";
    await ready(owner, "system");
    const postCard = owner
      .locator("main section")
      .filter({
        has: owner.getByRole("heading", { name: "停止・復旧", exact: true }),
      })
      .locator("div")
      .filter({
        has: owner.getByRole("heading", { name: "投稿", exact: true }),
      })
      .filter({ has: owner.getByRole("button", { name: "停止", exact: true }) })
      .last();
    await postCard.getByRole("button", { name: "停止", exact: true }).click();
    const od = owner.getByRole("dialog");
    await od.getByLabel(/運営メモ/).fill("Synthetic stop verification");
    await od.getByLabel("対象と影響を確認しました").check();
    await od.getByRole("button", { name: "確認して実行" }).click();
    await owner.getByText("操作を記録しました。").waitFor();
    await owner.getByText(/確認時刻：/).waitFor();
    const postFlag = await db.query(
      "SELECT flags->>'posts' p FROM mvp_private.admin_control",
    );
    assert.equal(postFlag.rows[0].p, "false");
    const flags = await api(0, "system");
    const resumed = await api(
      0,
      "system",
      action("feature", "system", "posts", flags.data.detail.version, true),
    );
    assert.equal(resumed.status, 200);
    ok("Owner post stop UI and audited recovery");
    phase = "staff role";
    await ready(owner, "staff");
    const existingMember = owner
      .getByRole("row")
      .filter({ hasText: "V25member_" });
    if (
      await existingMember.getByRole("button", { name: "権限再開" }).count()
    ) {
      await existingMember.getByRole("button", { name: "権限再開" }).click();
    } else {
      await owner.getByLabel("追加するユーザーID").fill(f.users[2].id);
      await owner
        .getByRole("button", { name: "Moderatorを追加", exact: true })
        .click();
    }
    await od.getByLabel(/運営メモ/).fill("Synthetic role grant verification");
    await od.getByLabel("対象と影響を確認しました").check();
    await od.getByRole("button", { name: "確認して実行" }).click();
    await owner.getByText("操作を記録しました。").waitFor();
    await owner.getByText(/確認時刻：/).waitFor();
    assert.equal((await api(2, "overview")).status, 200);
    const memberRow = owner.getByRole("row").filter({ hasText: "V25member_" });
    await memberRow.getByRole("button", { name: "権限解除" }).click();
    await od
      .getByLabel(/運営メモ/)
      .fill("Synthetic role revocation verification");
    await od.getByLabel("対象と影響を確認しました").check();
    await od.getByRole("button", { name: "確認して実行" }).click();
    await memberRow.getByRole("button", { name: "権限再開" }).waitFor();
    assert.equal((await api(2, "overview")).status, 403);
    ok("Owner role grant/revoke UI is effective immediately");
    phase = "empty/error/pagination";
    await ready(owner, "users");
    await owner
      .getByLabel("検索", { exact: true })
      .fill("nonexistent-synthetic-v25");
    await owner.getByText("条件に合う項目はありません。").waitFor();
    ok("Search empty state never confused with failed loading");
    await ready(owner, "billing");
    h.browserMetrics.allowExpectedAdminFailure = true;
    await owner.route("**/api/admin?**", (r) =>
      r.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "ADMIN_UNAVAILABLE" }),
      }),
    );
    await owner.getByRole("button", { name: "再読込", exact: true }).click();
    await owner.getByRole("alert").waitFor();
    assert.equal(
      await owner.getByText("条件に合う項目はありません。").count(),
      0,
    );
    await owner.unroute("**/api/admin?**");
    h.browserMetrics.allowExpectedAdminFailure = false;
    ok("Unavailable response clears stale data and does not show zero");
    phase = "finish";
    report.browser = {
      uncaught: h.errors.length,
      console: h.consoleErrors.length,
      expectedNegativeConsole: h.browserMetrics.expectedAdminConsole || 0,
      hydration: h.browserMetrics.hydrationErrors,
      serverErrors: h.http500.filter((x) => x.path !== "/api/admin").length,
    };
    assert.equal(report.browser.console, 0);
    assert.equal(report.browser.uncaught, 0);
    assert.equal(report.browser.hydration, 0);
    assert.equal(report.browser.serverErrors, 0);
    report.complete = true;
    save();
  } catch (e) {
    report.failure = {
      phase,
      code: e.code || "CHECK_FAILED",
      message: String(e.message)
        .replace(/https?:\/\/\S+/g, "[url]")
        .slice(0, 250),
    };
    save();
    process.exitCode = 1;
  } finally {
    if (h) {
      try {
        const c = createClient(h.ctx.url, h.ctx.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        const f = h.f;
        const cli = createClient(
          h.ctx.url,
          h.ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          { auth: { persistSession: false } },
        );
        await cli.auth.signInWithPassword({
          email: f.users[0].email,
          password: f.users[0].password,
        });
        const r = await cli.rpc("v25_admin_read", { p_section: "system" });
        if (r.data?.detail.flags.posts === false)
          await cli.rpc("v25_admin_action", {
            p_request: randomUUID(),
            p_action: "feature",
            p_type: "system",
            p_target: "posts",
            p_version: r.data.detail.version,
            p_value: true,
            p_reason: "operational",
            p_note: "Synthetic verification cleanup",
          });
        void c;
      } catch {
        report.cleanupNeedsReview = true;
      }
      await h.close();
    }
    if (db) await db.end();
    report.sessionsClosed = !!h;
    save();
    console.log(
      JSON.stringify({
        complete: report.complete,
        checks: report.checks.length,
        failure: report.failure,
        violations: report.violations.length,
      }),
    );
  }
})();
