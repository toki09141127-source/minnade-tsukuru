/* eslint-disable @typescript-eslint/no-require-imports -- Explicitly approved short-lived Preview-only access. */
const fs = require("fs"),
  cp = require("child_process"),
  assert = require("node:assert/strict");
const { d } = require("./preview-scope.cjs").deployment();
const cli = fs
  .readFileSync(".staging-private/vercel-cli-path.txt", "utf8")
  .trim();
const body = ".staging-private/v2rc-preview-login.html";
try {
  const r = cp.spawnSync(
    process.execPath,
    [
      cli,
      "curl",
      "/login",
      "--deployment",
      d.url,
      "--scope",
      "sonetokiyas-projects",
      "--",
      "--silent",
      "--show-error",
      "--header",
      "x-vercel-set-bypass-cookie: true",
      "--dump-header",
      "-",
      "--output",
      body,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2e6 },
  );
  assert.equal(r.status, 0, "PREVIEW_ACCESS_FAILED");
  const matches = [
    ...r.stdout.matchAll(/^set-cookie:\s*([^=;\s]+)=([^;\r\n]*)([^\r\n]*)/gim),
  ].filter((m) => m[1] === "_vercel_jwt");
  assert.equal(matches.length, 1, "COOKIE_MISSING");
  const m = matches[0],
    attrs = m[3];
  assert.match(attrs, /;\s*secure(?:;|$)/i, "COOKIE_SECURE");
  assert.match(attrs, /;\s*httponly(?:;|$)/i, "COOKIE_HTTP_ONLY");
  const domain = attrs.match(/;\s*domain=([^;]+)/i)?.[1];
  assert.ok(
    !domain || domain.toLowerCase() === new URL(d.url).hostname,
    "COOKIE_DOMAIN_SCOPE",
  );
  const path = attrs.match(/;\s*path=([^;]+)/i)?.[1] || "/";
  assert.equal(path, "/");
  const now = Date.now();
  let end = now + 2 * 3600000;
  const maxAge = attrs.match(/;\s*max-age=(\d+)/i)?.[1],
    expires = attrs.match(/;\s*expires=([^;]+)/i)?.[1];
  if (maxAge) end = Math.min(end, now + Number(maxAge) * 1000);
  if (expires && Number.isFinite(Date.parse(expires)))
    end = Math.min(end, Date.parse(expires));
  try {
    const p = JSON.parse(Buffer.from(m[2].split(".")[1], "base64url"));
    if (p.exp) end = Math.min(end, p.exp * 1000);
  } catch {}
  assert.ok(end > now, "COOKIE_EXPIRED");
  const cookies = [
    {
      name: m[1],
      value: m[2],
      domain: new URL(d.url).hostname,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      expires: Math.floor(end / 1000),
    },
  ];
  fs.writeFileSync(
    ".staging-private/v2rc-preview-access.json",
    JSON.stringify({
      url: d.url,
      cookies,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(end).toISOString(),
    }),
  );
  const proof = {
    complete: true,
    bootstrapOnly: true,
    host: new URL(d.url).hostname,
    hostOnly: true,
    secure: true,
    httpOnly: true,
    effectiveLifetimeSeconds: Math.floor((end - now) / 1000),
    rawHeadersSaved: false,
    valuesPrinted: false,
    protectionUnchanged: true,
  };
  fs.writeFileSync(
    "docs/v2-rc-preview-access-proof.json",
    JSON.stringify(proof, null, 2) + "\n",
  );
  console.log(JSON.stringify(proof));
} catch (e) {
  console.log(
    JSON.stringify({
      failure: "PREVIEW_ACCESS_REJECTED",
      code: e.code,
      reason: (e.message || "").match(/^[A-Z_]+/)?.[0] || "CHECK_FAILED",
    }),
  );
  process.exitCode = 1;
} finally {
  if (fs.existsSync(body)) fs.unlinkSync(body);
}
