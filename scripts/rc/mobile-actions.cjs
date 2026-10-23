/* eslint-disable @typescript-eslint/no-require-imports -- Hosted synthetic mobile safety checks. */
const fs = require("fs"),
  assert = require("node:assert/strict"),
  { randomUUID } = require("crypto"),
  { createClient } = require("@supabase/supabase-js");
(async () => {
  let h,
    db,
    client,
    phase = "setup";
  const report = process.argv.includes("--remaining")
    ? JSON.parse(fs.readFileSync("docs/v2-rc-preview-mobile-actions.json"))
    : {
        complete: false,
        scope: "Hosted Preview 375px actual controls",
        checks: [],
        violations: [],
        productionChanges: "NONE",
        liveBilling: "OFF",
      };
  if (report.failure) {
    report.previousSelectorFailure = report.failure;
    delete report.failure;
  }
  report.complete = false;
  const save = () =>
    fs.writeFileSync(
      "docs/v2-rc-preview-mobile-actions.json",
      JSON.stringify(report, null, 2) + "\n",
    );
  const ok = (name) => {
    report.checks.push({ name, pass: true });
    save();
    console.log("PASS " + name);
  };
  try {
    assert.ok(process.argv.includes("--preview"), "HOSTED_ONLY");
    h = await require("./harness.cjs")();
    db = (await require("../billing/db.cjs")()).db;
    report.previewUrl = h.base;
    client = createClient(h.ctx.url, h.ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({
      email: h.f.users[0].email,
      password: h.f.users[0].password,
    });
    assert.ok(!login.error);
    const p = await h.page(h.f.users[0]);
    await p.setViewportSize({ width: 375, height: 850 });
    const ready = async (section, target) => {
      await p.goto(
        h.base + "/admin/" + section + (target ? "?target=" + target : ""),
      );
      await p.getByText(/確認時刻：/).waitFor();
      assert.equal(await p.locator("main [role=alert]").count(), 0);
    };
    const dialog = p.getByRole("dialog");
    const complete = async () => {
      await dialog
        .getByLabel(/運営メモ/)
        .fill("Synthetic mobile safety verification");
      await dialog.getByLabel("対象と影響を確認しました").check();
      await dialog.getByRole("button", { name: "確認して実行" }).click();
      await dialog.waitFor({ state: "hidden" });
      await p.getByText(/確認時刻：/).waitFor();
      assert.equal(await p.locator("main [role=alert]").count(), 0);
    };
    const card = (label) =>
      p
        .locator("main section")
        .filter({
          has: p.getByRole("heading", { name: "停止・復旧", exact: true }),
        })
        .locator("div")
        .filter({ has: p.getByRole("heading", { name: label, exact: true }) })
        .last();
    if (!process.argv.includes("--remaining")) {
      phase = "keyboard confirmation";
      await ready("system");
      const stop = card("投稿").getByRole("button", {
        name: "停止",
        exact: true,
      });
      await stop.focus();
      await p.keyboard.press("Enter");
      await dialog.waitFor();
      assert.equal(
        await dialog.getByRole("button", { name: "確認して実行" }).isEnabled(),
        false,
      );
      assert.ok(
        await p.evaluate(() =>
          document.querySelector("dialog")?.contains(document.activeElement),
        ),
      );
      await p.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(
        await stop.evaluate((e) => e === document.activeElement),
        true,
      );
      assert.equal(
        (
          await db.query(
            "SELECT (flags->>'posts')::boolean enabled FROM mvp_private.admin_control",
          )
        ).rows[0].enabled,
        true,
      );
      ok(
        "Keyboard Enter opens confirmation; Escape restores focus without mutation",
      );
    }
    await ready("system");
    phase = "mobile stop recovery";
    for (const [key, label] of process.argv.includes("--remaining")
      ? [["uploads", "アップロード"]]
      : [
          ["posts", "投稿"],
          ["uploads", "アップロード"],
        ]) {
      // Labels are read from the current UI; unsupported labels stop the test.
      const c = card(label);
      await c.getByRole("button", { name: "停止", exact: true }).click();
      if (key === "posts") {
        await p.addScriptTag({
          content: fs.readFileSync(
            ".staging-private/ui-tools/node_modules/axe-core/axe.min.js",
            "utf8",
          ),
        });
        const v = await p.evaluate(async () => {
          const r = await window.axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
            },
          });
          return r.violations.map((x) => x.id);
        });
        report.violations.push(...v);
        assert.equal(v.length, 0);
      }
      await complete();
      assert.equal(
        (
          await db.query(
            "SELECT (flags->>$1)::boolean enabled FROM mvp_private.admin_control",
            [key],
          )
        ).rows[0].enabled,
        false,
      );
      await card(label)
        .getByRole("button", { name: "再開", exact: true })
        .click();
      await complete();
      assert.equal(
        (
          await db.query(
            "SELECT (flags->>$1)::boolean enabled FROM mvp_private.admin_control",
            [key],
          )
        ).rows[0].enabled,
        true,
      );
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      ok("375px " + key + " stop and recovery through confirmed UI");
    }
    phase = "room control";
    await ready("rooms", h.f.rooms.active);
    await p
      .getByRole("button", { name: "参加を停止", exact: true })
      .first()
      .click();
    await complete();
    assert.equal(
      (
        await db.query(
          "SELECT joins FROM admin_room_controls WHERE room_id=$1",
          [h.f.rooms.active],
        )
      ).rows[0].joins,
      false,
    );
    await p
      .getByRole("button", { name: "参加を再開", exact: true })
      .first()
      .click();
    await complete();
    assert.equal(
      (
        await db.query(
          "SELECT joins FROM admin_room_controls WHERE room_id=$1",
          [h.f.rooms.active],
        )
      ).rows[0].joins,
      true,
    );
    ok("Owner room-scoped joins stop/recovery works on mobile");
    await ready("system");
    await p.screenshot({
      path: ".staging-private/v2rc-preview-mobile-viewport.png",
      fullPage: false,
    });
    assert.equal(h.errors.length, 0);
    assert.equal(h.consoleErrors.length, 0);
    assert.equal(h.http500.length, 0);
    assert.equal(h.browserMetrics.hydrationErrors, 0);
    ok(
      "Mobile action browser has no console / hydration / uncaught / 5xx errors",
    );
    report.complete = true;
  } catch (e) {
    report.failure = { phase, code: e.code || "CHECK_FAILED" };
    process.exitCode = 1;
    console.log(JSON.stringify(report.failure));
  } finally {
    if (db && client) {
      try {
        const flags = (await db.query("SELECT mvp_private.v25_flags() flags"))
          .rows[0].flags;
        for (const k of ["posts", "uploads"])
          if (flags[k] !== h.f.initialFlags[k]) {
            const version = (
              await db.query("SELECT version FROM mvp_private.admin_control")
            ).rows[0].version;
            const r = await client.rpc("v25_admin_action", {
              p_request: randomUUID(),
              p_action: "feature",
              p_type: "system",
              p_target: k,
              p_version: version,
              p_value: h.f.initialFlags[k],
              p_reason: "operational",
              p_note: "Synthetic test cleanup",
            });
            assert.ok(!r.error && !r.data.error);
          }
        const room = (
          await db.query("SELECT * FROM admin_room_controls WHERE room_id=$1", [
            h.f.rooms.active,
          ])
        ).rows[0];
        if (room && !room.joins) {
          const version = (
            await db.query(
              "SELECT version FROM admin_subjects WHERE kind='room' AND target_id=$1",
              [h.f.rooms.active],
            )
          ).rows[0].version;
          const r = await client.rpc("v25_admin_action", {
            p_request: randomUUID(),
            p_action: "room_controls",
            p_type: "room",
            p_target: h.f.rooms.active,
            p_version: version,
            p_value: { joins: true, posts: room.posts, uploads: room.uploads },
            p_reason: "operational",
            p_note: "Synthetic test cleanup",
          });
          assert.ok(!r.error && !r.data.error);
        }
        report.controlsRestored = true;
      } catch {
        report.cleanupRequired = true;
        report.complete = false;
        process.exitCode = 1;
      }
    }
    if (h) {
      await h.close();
      report.browserClosed = true;
    }
    if (db) await db.end();
    save();
  }
})();
