/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs"),
  cp = require("child_process"),
  path = require("path"),
  assert = require("node:assert/strict");
const ctx = require("../staging/safety.cjs").load(),
  project = JSON.parse(fs.readFileSync(".vercel/project.json"));
assert.equal(project.projectId, "prj_Qo1OsPU4tdgA2fluqzbAr1kTk6Dy");
assert.equal(project.projectName, "minnade-tsukuru-staging");
const cli = fs
    .readFileSync(".staging-private/vercel-cli-path.txt", "utf8")
    .trim(),
  file = path.resolve(".staging-private/v25-preview-env.private");
const r = cp.spawnSync(
  process.execPath,
  [
    cli,
    "env",
    "pull",
    file,
    "--environment",
    "preview",
    "--yes",
    "--scope",
    "sonetokiyas-projects",
  ],
  { encoding: "utf8", windowsHide: true, timeout: 45000 },
);
const report = { complete: false, productionChanges: "NONE" };
try {
  assert.equal(r.status, 0, "PREVIEW_ENV_READ");
  const env = require("dotenv").parse(fs.readFileSync(file));
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, ctx.url, "STAGING_DB");
  const written = JSON.parse(fs.readFileSync("docs/v2-5-preview-env.json"));
  assert.ok(
    written.complete &&
      written.project === "minnade-tsukuru-staging" &&
      written.environment === "preview" &&
      ["SUPABASE_SERVICE_ROLE_KEY", "STRIPE_TEST_SECRET_KEY"].every((k) =>
        written.updated.includes(k),
      ),
    "SENSITIVE_CONFIG_PROOF",
  );
  report.sensitiveVariables =
    "explicitly set from validated staging configuration; raw pulled values not used as evidence";
  assert.equal(env.V2_ENABLED, "true");
  assert.equal(env.ADMIN_ENABLED, "true");
  assert.equal(env.BILLING_PROVIDER, "stripe_test");
  assert.match(ctx.env.STRIPE_TEST_SECRET_KEY, /^sk_test_/);
  assert.equal(env.AI_ENABLED, "false");
  assert.equal(env.MVP_ACCOUNT_FINALIZE_ENABLED, "false");
  report.complete = true;
  report.projectRef = ctx.ref;
  report.aiEnabled = false;
  report.liveBilling = "OFF";
  report.adminEnabled = true;
} catch (e) {
  report.failure = /^[A-Z_]+$/.test(e.message || "")
    ? e.message
    : "ENV_CHECK_FAILED";
  process.exitCode = 1;
} finally {
  if (fs.existsSync(file)) fs.unlinkSync(file);
  fs.writeFileSync(
    "docs/v2-5-preview-preflight.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
