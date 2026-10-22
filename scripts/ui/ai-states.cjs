/* eslint-disable @typescript-eslint/no-require-imports -- Browser-only synthetic AI state tests. */
const fs = require("fs"),
  assert = require("node:assert/strict");
(async () => {
  let h,
    phase = "setup";
  const out = {
      scope: "browser route mocks only; zero provider calls",
      checks: [],
      complete: false,
      productionChanges: "NONE",
    },
    save = () =>
      fs.writeFileSync(
        "docs/v2-3-" + (h?.hosted ? "preview-" : "") + "ai-ui-result.json",
        JSON.stringify(out, null, 2) + "\n",
      ),
    ok = (name) => {
      out.checks.push({ name, pass: true });
      save();
      console.log("PASS " + name);
    };
  try {
    h = await require("./harness.cjs")();
    const p = await h.page(h.f.users[0]);
    let mode = "long";
    const mock = {
      identity: "TEST-AI",
      enabled: true,
      outputs: [
        {
          id: "test-output",
          kind: "summarize",
          sources: [],
          created_at: "2026-10-23T00:00:00Z",
          trigger_type: "manual",
          base_version: 0,
          accepted_at: null,
          payload: {
            message: "TEST 合成AIの表示検収です。",
            decisions: [],
            unresolved: [
              {
                text: "TEST 長い候補を折り返して表示します。".repeat(120),
                refs: [],
              },
            ],
            nextActions: [
              { text: "TEST 次の場面を相談しましょう。", refs: [] },
            ],
            highlightNotes: [],
            draftText: "",
          },
        },
      ],
      tasks: [
        {
          id: "TEST-task",
          kind: "summarize",
          status: "running",
          error_code: null,
          created_at: "2026-10-23T00:00:00Z",
          trigger_type: "manual",
        },
      ],
    };
    await p.route("**/api/v2/ai*", async (r) => {
      if (mode === "error")
        return r.fulfill({ status: 503, json: { error: "TEST failure" } });
      if (r.request().method() === "POST") {
        await new Promise((a) => setTimeout(a, 1200));
        return r.fulfill({ status: 202, json: { taskId: "TEST-task" } });
      }
      if (mode === "loading") await new Promise((a) => setTimeout(a, 1800));
      return r.fulfill({
        status: 200,
        json: mode === "empty" ? { ...mock, outputs: [], tasks: [] } : mock,
      });
    });
    phase = "long";
    await p.goto(h.base + "/rooms/" + h.f.room);
    await p.getByRole("button", { name: "AIに聞く ↗", exact: true }).click();
    await p
      .getByRole("heading", { name: "未決事項・確認候補", exact: true })
      .waitFor();
    for (const width of [320, 390, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    ok("Long synthetic summary wraps at mobile and desktop");
    phase = "manual loading";
    await p.getByLabel("AIへの質問・依頼").fill("TEST UIのみの質問です");
    await p.getByRole("button", { name: "AIに依頼する", exact: true }).click();
    await p
      .getByRole("button", { name: "AI Creatorが整理しています…", exact: true })
      .waitFor();
    await p
      .getByRole("button", { name: "AIに依頼する", exact: true })
      .waitFor();
    ok("Manual AI request has a nonblocking processing state");
    phase = "empty";
    mode = "empty";
    await p.reload();
    await p.getByRole("button", { name: "AIに聞く ↗", exact: true }).click();
    await p
      .getByText("制作が進むとAI Creatorがここに整理します。", { exact: true })
      .waitFor();
    ok("Empty AI summary explains when content appears");
    phase = "error";
    mode = "error";
    await p.reload();
    await p.getByRole("button", { name: "AIに聞く ↗", exact: true }).click();
    await p
      .getByText(
        "AI Creatorは現在利用できません。制作はそのまま続けられます。",
        { exact: true },
      )
      .waitFor();
    await p.getByRole("button", { name: "制作ログ", exact: true }).click();
    await p.waitForFunction(() => {
      const e = document.querySelector('textarea[maxlength="20000"]');
      return e && !e.disabled;
    });
    assert.ok(
      await p.getByLabel("制作ログに投稿", { exact: true }).isEnabled(),
    );
    ok("Synthetic AI failure leaves human composer usable");
    assert.equal(h.errors.length, 0);
    out.expectedMockHttp503 = h.http500.filter(
      (x) => x.status === 503 && x.path === "/api/v2/ai",
    ).length;
    assert.ok(
      h.http500.every((x) => x.status === 503 && x.path === "/api/v2/ai"),
    );
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
