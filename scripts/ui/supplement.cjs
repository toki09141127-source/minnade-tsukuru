/* eslint-disable @typescript-eslint/no-require-imports -- Loaded-content and Core acceptance. */
const fs = require("fs"),
  assert = require("node:assert/strict");
(async () => {
  let h,
    phase = "setup";
  const out = { checks: [], complete: false, productionChanges: "NONE" };
  const save = () =>
    fs.writeFileSync(
      "docs/v2-3-preview-supplement-result.json",
      JSON.stringify(out, null, 2) + "\n",
    );
  const ok = (name) => {
    out.checks.push({ name, pass: true });
    save();
    console.log("PASS " + name);
  };
  try {
    h = await require("./harness.cjs")();
    assert.ok(h.hosted, "HOSTED_ONLY");
    phase = "Core editing";
    const core = await h.page(h.ai.users[2]);
    await core.goto(h.base + "/rooms/" + h.ai.rooms.assist);
    await core
      .getByRole("button", { name: "AIに聞く ↗", exact: true })
      .waitFor();
    await core.locator("article").first().waitFor();
    const article = core.locator("article").first();
    const highlight = article.getByRole("button", {
      name: "ハイライト",
      exact: true,
    });
    if (await highlight.isVisible()) {
      await highlight.click();
      await article
        .getByRole("button", { name: "ハイライト解除", exact: true })
        .waitFor();
    } else {
      await article
        .getByRole("button", { name: "ハイライト解除", exact: true })
        .click();
      await highlight.waitFor();
      await highlight.click();
      await article
        .getByRole("button", { name: "ハイライト解除", exact: true })
        .waitFor();
    }
    ok("Core changes highlight through Hosted UI");
    await core
      .getByRole("button", { name: "AIに聞く ↗", exact: true })
      .click();
    await core
      .getByText(
        "AIは現在停止中です。人間の投稿・ドラフト編集は続けられます。",
        { exact: true },
      )
      .waitFor();
    assert.ok(
      await core
        .getByRole("button", { name: "AIに依頼する", exact: true })
        .isDisabled(),
    );
    ok("Core AI request respects stopped feature state");
    await core
      .getByRole("button", { name: "完成作品ドラフト", exact: true })
      .click();
    await core.getByLabel("追加するブロック").selectOption("text");
    await core
      .getByRole("button", { name: "ブロックを追加", exact: true })
      .click();
    await core
      .getByLabel("本文の内容", { exact: true })
      .last()
      .fill("TEST Coreが合成作品の文章を編集しました。");
    await core
      .getByLabel("個人情報・権利・公開する内容を確認しました", { exact: true })
      .check();
    await core
      .getByRole("button", { name: "完成作品ドラフトを保存", exact: true })
      .click();
    await core
      .locator("section")
      .filter({
        has: core.getByRole("heading", {
          name: "完成作品ドラフト",
          exact: true,
        }),
      })
      .getByText("保存しました。", { exact: true })
      .waitFor();
    ok("Core saves human draft successfully through Hosted UI");
    const p = await h.page(h.f.users[0]),
      axe = fs.readFileSync(
        ".staging-private/ui-tools/node_modules/axe-core/axe.min.js",
        "utf8",
      );
    for (const [name, url] of [
      ["room", "/rooms/" + h.f.room],
      ["log", "/works/" + h.ai.extra.publication + "/log"],
    ]) {
      phase = "loaded " + name;
      await p.goto(h.base + url);
      await p.locator("article").first().waitFor();
      await p
        .getByText("処理中…", { exact: true })
        .waitFor({ state: "hidden" });
      const count = await p.locator("article").count();
      assert.ok(count > 0 && count <= 30, "BOUNDED_LOG_DOM");
      for (const width of [320, 375, 390, 768, 1024, 1440]) {
        await p.setViewportSize({ width, height: 1000 });
        await p.evaluate(() => window.scrollTo(0, 0));
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "LOADED_OVERFLOW",
        );
        if ([320, 375, 390, 1440].includes(width))
          await p.screenshot({
            path: ".staging-private/v23-preview-" + name + "-" + width + ".png",
            fullPage: true,
          });
        if ([390, 1440].includes(width)) {
          await p.addScriptTag({ content: axe });
          const a = await p.evaluate(async () => {
            const r = await window.axe.run(document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
              },
            });
            return r.violations.map((v) => ({ id: v.id, impact: v.impact }));
          });
          assert.equal(a.length, 0, "LOADED_AXE_" + name);
        }
      }
      ok(
        "Loaded " +
          name +
          " content: six widths, bounded DOM and zero axe violations",
      );
    }
    assert.equal(h.errors.length, 0);
    assert.equal(h.http500.length, 0);
    out.complete = true;
    save();
  } catch (e) {
    out.failure = {
      phase,
      message: String(e.message)
        .replace(/https?:\/\/\S+/g, "[URL]")
        .slice(0, 200),
    };
    save();
    console.log(JSON.stringify(out.failure));
    process.exitCode = 1;
  } finally {
    if (h) await h.close();
  }
})();
