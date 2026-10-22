/* eslint-disable @typescript-eslint/no-require-imports -- Accessibility and responsive acceptance. */
const fs = require("fs"),
  assert = require("node:assert/strict");
(async () => {
  let h,
    phase = "setup";
  const out = {
    checks: [],
    violations: [],
    complete: false,
    productionChanges: "NONE",
  };
  const save = () =>
      fs.writeFileSync(
        "docs/v2-3-" + (h?.hosted ? "preview-" : "") + "visual-result.json",
        JSON.stringify(out, null, 2) + "\n",
      ),
    ok = (name) => {
      out.checks.push({ name, pass: true });
      save();
      console.log("PASS " + name);
    };
  try {
    h = await require("./harness.cjs")();
    const p = await h.page(h.f.users[0]),
      axe = fs.readFileSync(
        ".staging-private/ui-tools/node_modules/axe-core/axe.min.js",
        "utf8",
      );
    async function audit(name) {
      await p.addScriptTag({ content: axe });
      const a = await p.evaluate(async () => {
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
      out.violations.push(...a.map((x) => ({ page: name, ...x })));
      save();
      assert.equal(a.length, 0, "AXE_" + name);
      ok(name + " WCAG A/AA automated checks");
    }
    for (const [name, url] of [
      ["home", "/"],
      ["rooms", "/rooms"],
      ["create", "/rooms/create"],
      ["room", "/rooms/" + h.f.room],
      ["works", "/works"],
      ["work", "/works/" + h.ai.extra.publication],
      ["log", "/works/" + h.ai.extra.publication + "/log"],
      ["mypage", "/mypage"],
      ["profile", "/profile"],
      ["login", "/login"],
    ]) {
      phase = name;
      await p.goto(h.base + url);
      await p.locator("h1").first().waitFor();
      await p
        .getByRole("status", { name: "読み込み中", exact: true })
        .waitFor({ state: "hidden" })
        .catch(async () => {
          await p.waitForFunction(
            () =>
              document.querySelectorAll('[aria-label="読み込み中"]').length ===
              0,
          );
        });
      if (["home", "rooms", "works", "mypage"].includes(name)) {
        await p.waitForFunction(
          () =>
            document.querySelectorAll('.catalogGrid[role="status"]').length ===
            0,
        );
        await p.locator(".catalogGrid article, .emptyState").first().waitFor();
      }
      await p.waitForTimeout(300);
      for (const width of [320, 375, 390, 768, 1024, 1440]) {
        await p.setViewportSize({ width, height: 1000 });
        await p.evaluate(() => window.scrollTo(0, 0));
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "OVERFLOW_" + name + "_" + width,
        );
        if ([320, 375, 390, 1440].includes(width))
          await p.screenshot({
            path:
              ".staging-private/v23-" +
              (h.hosted ? "preview-" : "") +
              name +
              "-" +
              width +
              ".png",
            fullPage: true,
          });
        if ([390, 1440].includes(width)) await audit(name + " " + width);
      }
      ok(name + " six responsive widths");
    }
    phase = "draft";
    await p.goto(h.base + "/rooms/" + h.f.room);
    await p
      .getByRole("button", { name: "完成作品ドラフト", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "完成作品ドラフト", exact: true })
      .waitFor();
    await audit("Draft editor");
    const top = await p.locator("aside").last().boundingBox(),
      tools = await p
        .getByRole("button", { name: "完成作品ドラフト", exact: true })
        .boundingBox();
    assert.ok(top && tools && top.y - tools.y < 160, "SIDEBAR_TOP_ALIGNMENT");
    ok("Long draft keeps sidebar at the top");
    for (const width of [320, 375, 390, 1440]) {
      await p.setViewportSize({ width, height: 1000 });
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path:
          ".staging-private/v23-" +
          (h.hosted ? "preview-" : "") +
          "draft-" +
          width +
          ".png",
        fullPage: true,
      });
    }
    ok("Draft editor and preview responsive");
    for (const type of [
      "heading",
      "summary",
      "text",
      "image",
      "list",
      "divider",
      "link",
    ]) {
      await p.getByLabel("追加するブロック").selectOption(type);
      await p
        .getByRole("button", { name: "ブロックを追加", exact: true })
        .click();
    }
    ok("Seven block types can be added without saving");
    const del = p.getByRole("button", { name: /ブロック\d+を削除/ });
    const before = await del.count();
    await del.last().click();
    assert.equal(await del.count(), before - 1);
    const up = p.getByRole("button", { name: /ブロック\d+を上へ/ }).last();
    await up.click();
    ok("Block removal and keyboard-friendly reorder operate");
    phase = "AI";
    const ap = await h.page(h.ai.users[0]);
    await ap.goto(h.base + "/rooms/" + h.ai.rooms.assist);
    await ap
      .getByRole("button", { name: "AIまとめ", exact: true })
      .first()
      .click();
    await ap
      .getByRole("heading", { name: "人間が明示した決定事項", exact: true })
      .waitFor();
    await ap.getByRole("button", { name: "AI発言・履歴", exact: true }).click();
    await ap.getByText("AI Creator · AI", { exact: true }).first().waitFor();
    ok("Stored synthetic greeting, summary and messages remain visibly AI");
    for (const width of [320, 375, 390, 1440]) {
      await ap.setViewportSize({ width, height: 1000 });
      assert.ok(
        await ap.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await ap.screenshot({
        path:
          ".staging-private/v23-" +
          (h.hosted ? "preview-" : "") +
          "ai-" +
          width +
          ".png",
        fullPage: true,
      });
    }
    ok("AI messages fit mobile and desktop");
    assert.equal(h.errors.length, 0);
    assert.equal(h.http500.length, 0);
    ok("No uncaught errors or HTTP500 on displayed pages");
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
