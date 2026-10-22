/* eslint-disable @typescript-eslint/no-require-imports -- Feature-stop fallback acceptance. */
const fs = require("fs"),
  assert = require("node:assert/strict");
if (!process.argv.includes("--v2-off")) throw Error("OFF_FLAG_REQUIRED");
(async () => {
  let h;
  const out = { checks: [], complete: false, productionChanges: "NONE" };
  try {
    h = await require("./harness.cjs")();
    const p = await h.page();
    for (const [route, heading] of [
      ["/", "つくりたい人"],
      ["/rooms", "ルームを探す"],
      ["/works", "みんなで生まれた作品"],
      ["/mypage", "マイページ"],
    ]) {
      await p.goto(h.base + route);
      await p.getByRole("heading", { name: new RegExp(heading) }).waitFor();
      assert.equal(
        await p
          .getByText("この機能は利用できません。", { exact: true })
          .count(),
        0,
      );
      out.checks.push({ name: "V2 OFF navigation " + route, pass: true });
    }
    assert.equal((await fetch(h.base + "/api/v2/catalog")).status, 503);
    out.checks.push({ name: "Stopped V2 API remains closed", pass: true });
    assert.equal(h.errors.length, 0);
    out.complete = true;
  } catch {
    out.failure = "FALLBACK_CHECK_FAILED";
    process.exitCode = 1;
  } finally {
    if (h) await h.close();
    fs.writeFileSync(
      "docs/v2-3-fallback-result.json",
      JSON.stringify(out, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({ complete: out.complete, checks: out.checks.length }),
    );
  }
})();
