/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs = require("fs"),
  cp = require("child_process"),
  ctx = require("../staging/safety.cjs").load();
const env = {
  ...process.env,
  ...ctx.env,
  SUPABASE_URL: ctx.url,
  V2_ENABLED: "true",
  ADMIN_ENABLED: "true",
  AI_ENABLED: "true",
  AI_PROVIDER: "synthetic",
  OPENAI_API_KEY: "",
  NODE_OPTIONS: "",
  NEXT_TELEMETRY_DISABLED: "1",
};
for (const flag of [
  "ATOMIC_CORE",
  "ATOMIC_JOIN",
  "DB_GUARDS",
  "UPLOADS",
  "ROOM_CREATION",
  "DRAFTS",
  "LIKE_REQUESTS",
  "MEMBERSHIP_GUARDS",
  "REPORT_INTAKE",
  "REPORT_QUEUE",
  "MODERATION",
  "ACCOUNT_ATTRIBUTION",
])
  env["MVP_" + flag + "_ENABLED"] = "true";
env.MVP_ACCOUNT_REQUESTS_ENABLED = "false";
env.MVP_ACCOUNT_FINALIZE_ENABLED = "false";
const run = cp.spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", "--webpack"],
  { env, windowsHide: true, encoding: "utf8", timeout: 300000, maxBuffer: 8e6 },
);
const output = (run.stdout || "") + (run.stderr || "");
fs.mkdirSync(".staging-private", { recursive: true });
fs.writeFileSync(".staging-private/v2rc-build.log", output);
fs.writeFileSync(
  "docs/v2-rc-build-result.json",
  JSON.stringify({
    complete: run.status === 0,
    exitCode: run.status,
    productionChanges: "NONE",
  }) + "\n",
);
console.log(
  JSON.stringify({ complete: run.status === 0, exitCode: run.status }),
);
process.exitCode = run.status === 0 ? 0 : 1;
