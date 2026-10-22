/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs = require("fs"),
  cp = require("child_process"),
  path = require("path"),
  ctx = require("../staging/safety.cjs").load();
const dir = fs
    .readFileSync(".staging-private/v23-preview-dir.txt", "utf8")
    .trim(),
  cli = fs.readFileSync(".staging-private/vercel-cli-path.txt", "utf8").trim();
const project = JSON.parse(
  fs.readFileSync(path.join(dir, ".vercel/project.json")),
);
if (
  project.projectId !== "prj_Qo1OsPU4tdgA2fluqzbAr1kTk6Dy" ||
  project.projectName !== "minnade-tsukuru-staging"
)
  throw Error("STAGING_PROJECT_REQUIRED");
const r = cp.spawnSync(
  process.execPath,
  [
    cli,
    "deploy",
    "--yes",
    "--environment",
    "preview",
    "--scope",
    "sonetokiyas-projects",
    "--cwd",
    dir,
    "--no-wait",
    "--json",
  ],
  { encoding: "utf8", windowsHide: true, timeout: 120000, maxBuffer: 4e6 },
);
let raw = (r.stdout || "") + (r.stderr || "");
for (const v of Object.values(ctx.env))
  if (v && v.length > 15) raw = raw.split(v).join("[REDACTED]");
fs.writeFileSync(".staging-private/v23-deploy.log", raw);
if (r.status !== 0) {
  console.log(
    JSON.stringify({
      deployed: false,
      exitCode: r.status,
      diagnostic: raw.slice(-1000),
    }),
  );
  process.exit(1);
}
const urls =
  raw.match(/https:\/\/minnade-tsukuru-staging-[a-z0-9-]+\.vercel\.app/g) || [];
if (!urls.length) throw Error("DEPLOYMENT_URL_NOT_FOUND");
const result = {
  url: urls[0],
  project: project.projectName,
  projectId: project.projectId,
  scope: "sonetokiyas-projects",
  target: "preview",
  sourceCommit: cp
    .execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })
    .trim(),
  state: "QUEUED",
  aiGenerationEnabled: false,
  productionChanges: "NONE",
};
fs.writeFileSync(
  "docs/v2-3-preview-deployment.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
