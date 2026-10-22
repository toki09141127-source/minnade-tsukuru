/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs = require("fs"),
  assert = require("node:assert/strict"),
  ctx = require("../staging/safety.cjs").load();
const d = JSON.parse(fs.readFileSync("docs/v2-3-preview-deployment.json")),
  access = JSON.parse(
    fs.readFileSync(".staging-private/v23-preview-access.json"),
  ),
  s = JSON.parse(fs.readFileSync(".staging-private/v22-e2e.json"));
assert.equal(access.url, d.url);
assert.equal(d.target, "preview");
assert.equal(s.projectRef, ctx.ref);
const cookie = access.cookies.map((c) => c.name + "=" + c.value).join("; "),
  values = ["OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"]
    .map((k) => ctx.env[k])
    .filter((v) => v && v.length > 15);
const result = {
  scope: "deployed Preview HTML and referenced client scripts",
  assetCount: 0,
  secretValueHits: 0,
  complete: false,
  productionChanges: "NONE",
};
(async () => {
  try {
    const paths = [
        "/login",
        "/rooms/" + s.rooms.assist,
        "/works/" + s.extra.publication + "/log",
      ],
      assets = new Set();
    const read = async (url) => {
      assert.equal(new URL(url).origin, d.url);
      const r = await fetch(url, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(r.status, 200);
      assert.equal(new URL(r.url).origin, d.url);
      return r.text();
    };
    const scan = (text) => {
      result.assetCount++;
      for (const v of values) if (text.includes(v)) result.secretValueHits++;
    };
    for (const p of paths) {
      const html = await read(d.url + p);
      scan(html);
      for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g))
        if (m[1].startsWith("/_next/static/")) assets.add(m[1]);
    }
    for (const asset of assets) scan(await read(d.url + asset));
    assert.ok(assets.size > 0);
    assert.equal(result.secretValueHits, 0);
    result.complete = true;
  } catch {
    result.failure = "DEPLOYED_SECRET_SCAN_FAILED";
    process.exitCode = 1;
  }
  fs.writeFileSync(
    "docs/v2-3-preview-secret-scan.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
})();
