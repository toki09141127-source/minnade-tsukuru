/* eslint-disable @typescript-eslint/no-require-imports -- UI-only degraded-state responses, no billing mutations. */
const fs = require("fs"),
  assert = require("node:assert/strict");
(async () => {
  let h;
  const out = {
    complete: false,
    checks: [],
    scope: "UI route mocks only; no payment mutation",
    productionChanges: "NONE",
  };
  const ok = (name) => {
    out.checks.push({ name, pass: true });
    console.log("PASS " + name);
  };
  try {
    h = await require("./harness.cjs")();
    const p = await h.page(h.f.users[0]);
    let mode = "past_due",
      pending = false;
    await p.route("**/api/billing*", async (route) => {
      const u = new URL(route.request().url());
      if (
        route.request().method() !== "GET" ||
        u.searchParams.get("action") === "plans"
      ) {
        if (u.searchParams.get("action") === "plans")
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              paymentsEnabled: true,
              config: {
                plans: {
                  plus: { monthly: 780, yearly: 7800 },
                  pro: { monthly: 1980, yearly: 19800 },
                },
              },
            }),
          });
        return route.continue();
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan: "free",
          status: mode,
          cycle: "month",
          renewalAt: new Date().toISOString(),
          graceUntil: new Date(Date.now() - 1000).toISOString(),
          cancelAtEnd: false,
          nextPlan: null,
          nextCycle: null,
          profiles: [],
          credits: {
            granted: 50,
            consumed: 0,
            reserved: 0,
            remaining: 50,
            periodEnd: new Date().toISOString(),
          },
          pendingOperation: pending
            ? {
                id: "00000000-0000-4000-8000-000000000001",
                selection: { action: "change", plan: "pro", cycle: "month" },
              }
            : null,
        }),
      });
    });
    for (const status of ["past_due", "unpaid", "incomplete"]) {
      mode = status;
      await p.goto(h.base + "/billing");
      await p.getByRole("heading", { name: "Free", exact: true }).waitFor();
      assert.ok(
        await p
          .getByRole("button", { name: "支払い方法・請求書", exact: true })
          .isEnabled(),
      );
      assert.ok(
        await p
          .getByRole("button", { name: "次回更新で解約", exact: true })
          .isEnabled(),
      );
      ok(status + " retains payment recovery and cancellation controls");
    }
    pending = true;
    await p.reload();
    await p.getByRole("heading", { name: "Free", exact: true }).waitFor();
    assert.equal(
      await p
        .getByRole("button", { name: "テスト決済で手続きを確認", exact: true })
        .isEnabled(),
      false,
    );
    ok("Unknown operation blocks a different payment intent after reload");
    out.complete = true;
  } catch {
    out.failure = "STATE_UI_FAILED";
    process.exitCode = 1;
  } finally {
    if (h) await h.close();
    fs.writeFileSync(
      "docs/v2-4-" +
        (process.argv.includes("--preview") ? "preview-" : "") +
        "states.json",
      JSON.stringify(out, null, 2) + "\n",
    );
  }
})();
