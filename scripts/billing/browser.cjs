/* eslint-disable @typescript-eslint/no-require-imports -- Staging-only UI acceptance. */
const fs = require("fs"),
  assert = require("node:assert/strict");
(async () => {
  let h,
    phase = "harness";
  const out = {
    complete: false,
    checks: [],
    violations: [],
    productionChanges: "NONE",
    liveBilling: "OFF",
  };
  const save = () =>
    fs.writeFileSync(
      "docs/v2-4-" +
        (process.argv.includes("--preview") ? "preview" : "local") +
        "-ui.json",
      JSON.stringify(out, null, 2) + "\n",
    );
  const ok = (name) => {
    out.checks.push({ name, pass: true });
    save();
    console.log("PASS " + name);
  };
  try {
    h = await require("./harness.cjs")();
    const p = await h.page(h.f.users[0]);
    const axe = fs.readFileSync(
      ".staging-private/ui-tools/node_modules/axe-core/axe.min.js",
      "utf8",
    );
    async function audit(name) {
      await p.addScriptTag({ content: axe });
      const v = await p.evaluate(async () => {
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
      out.violations.push(...v.map((x) => ({ page: name, ...x })));
      save();
      assert.equal(v.length, 0, "AXE");
      ok(name + " axe A/AA");
    }
    async function widths(name) {
      for (const width of [320, 375, 390, 768, 1024, 1440]) {
        await p.setViewportSize({ width, height: 1000 });
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "OVERFLOW",
        );
        if ([390, 1440].includes(width)) await audit(name + " " + width);
        if ([320, 1440].includes(width))
          await p.screenshot({
            path:
              ".staging-private/v24-" +
              (h.hosted ? "preview-" : "") +
              name +
              "-" +
              width +
              ".png",
            fullPage: true,
          });
      }
      ok(name + " six widths");
    }
    phase = "pricing";
    await p.goto(h.base + "/pricing");
    await p.getByRole("heading", { name: "プランを比べる" }).waitFor();
    assert.equal(await p.locator("main article").count(), 3);
    await widths("pricing-month");
    await p.getByRole("button", { name: "年払い", exact: true }).focus();
    await p.keyboard.press("Enter");
    assert.ok((await p.locator("main").innerText()).includes("¥7,800"));
    assert.ok((await p.locator("main").innerText()).includes("¥19,800"));
    ok("Keyboard yearly toggle uses configured prices");
    await widths("pricing-year");
    await p
      .getByRole("link", { name: "Proの手続きを確認", exact: true })
      .click();
    await p.getByRole("heading", { name: "Pro", exact: true }).waitFor();
    ok("Pricing links to current account billing");
    phase = "billing";
    await widths("billing");
    assert.ok((await p.locator("main").innerText()).includes("残り"));
    await p.getByRole("button", { name: "状態を更新", exact: true }).click();
    ok("Billing refresh and usage render");
    phase = "profile-edit-button";
    const edit = p.getByRole("button", { name: "編集", exact: true }).first();
    await edit.click();
    phase = "profile-edit-name";
    await p
      .getByLabel("AIの名前", { exact: true })
      .fill("テスト編集パートナー");
    await p
      .getByLabel("制作上の希望", { exact: true })
      .fill("短い提案を優先し、人間が決めるのを待ちます。");
    phase = "profile-editor-audit";
    await widths("profile-editor");
    await p.getByRole("button", { name: "保存する", exact: true }).click();
    await p
      .getByText("AIプロフィールを保存しました。", { exact: true })
      .waitFor();
    ok("Pro profile can be edited and saved through UI");
    phase = "room";
    await p.goto(h.base + "/rooms/" + h.f.rooms[0]);
    await p
      .getByRole("group", { name: "ルームの表示" })
      .getByRole("button", { name: "AIまとめ", exact: true })
      .click();
    await p.getByLabel("AI Creatorのプラン").getByRole("heading").waitFor();
    await p.getByText("AIの個性・設定", { exact: true }).click();
    await p.getByLabel("AIの名前", { exact: true }).fill("テスト共同編集者");
    await p.getByLabel("停滞時の声掛け", { exact: true }).selectOption("24");
    await widths("room-settings");
    await p.getByRole("button", { name: "AI設定を保存", exact: true }).click();
    await p
      .getByText("設定を保存しました。次のAI依頼から使われます。", {
        exact: true,
      })
      .waitFor();
    ok("Creator settings persisted with 24-hour timing");
    const core = await h.page(h.f.users[1]);
    await core.goto(h.base + "/rooms/" + h.f.rooms[0]);
    await core
      .getByRole("group", { name: "ルームの表示" })
      .getByRole("button", { name: "AIまとめ", exact: true })
      .click();
    await core
      .getByText("AIの個性はCreatorが設定します。", { exact: true })
      .waitFor();
    assert.equal(
      await core
        .getByRole("button", { name: "AI設定を保存", exact: true })
        .count(),
      0,
    );
    ok("Core sees Creator pool and cannot edit personality");
    const member = await h.page(h.f.users[2]);
    await member.goto(h.base + "/billing");
    await member.getByRole("heading", { name: "Free", exact: true }).waitFor();
    assert.equal(
      await member
        .getByRole("button", { name: "新しいプロフィール", exact: true })
        .isEnabled(),
      false,
    );
    ok("Free member profile editor locked");
    phase = "auth";
    const anon = await h.page();
    const status = await anon.request.get(h.base + "/api/billing");
    assert.equal(status.status(), 401);
    ok("Anonymous private billing API denied");
    assert.equal(h.errors.length, 0);
    assert.equal(h.http500.length, 0);
    ok("No uncaught errors or HTTP 5xx");
    out.complete = true;
  } catch (e) {
    out.failure = {
      phase,
      code: e.code || "CHECK_FAILED",
      message: /^[A-Z_]+$/.test(e.message || "")
        ? e.message
        : "UI assertion failed; no page content retained",
    };
    console.log(JSON.stringify(out.failure));
    process.exitCode = 1;
  } finally {
    if (h) await h.close();
    save();
  }
})();
