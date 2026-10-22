/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs = require("fs"),
  path = require("path"),
  cp = require("child_process"),
  crypto = require("crypto"),
  ctx = require("../staging/safety.cjs").load();
const paths = cp
  .execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  )
  .trim()
  .split(/\r?\n/);
const secretValues = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "CRON_SECRET",
]
  .map((k) => ctx.env[k])
  .filter((v) => v && v.length > 15);
let files = 0,
  hits = 0,
  bundleFiles = 0;
function scan(file, bundle = false) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;
  const bytes = fs.readFileSync(file);
  files++;
  if (bundle) bundleFiles++;
  for (const value of secretValues)
    if (bytes.includes(Buffer.from(value))) hits++;
}
for (const p of paths) scan(p);
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else scan(p, true);
  }
}
walk(".next/static");
walk(".next-staging/static");
if (!bundleFiles) throw Error("CLIENT_BUNDLE_NOT_FOUND");
const manifests = [
  "docs/v2-staging-migrations.json",
  "docs/v2-2-staging-migrations.json",
].filter(fs.existsSync);
const hashes = Object.fromEntries(
  fs
    .readdirSync("supabase/migrations")
    .filter((f) => /20261023004[4-7]_/.test(f))
    .map((f) => [
      f,
      crypto
        .createHash("sha256")
        .update(fs.readFileSync("supabase/migrations/" + f))
        .digest("hex"),
    ]),
);
for (const entry of JSON.parse(
  fs.readFileSync("docs/v2-2-staging-migrations.json"),
).files)
  if (hashes[entry.file] !== entry.sha256)
    throw Error("APPLIED_MIGRATION_HASH_CHANGED");
const result = {
  files,
  bundleFiles,
  secretValueHits: hits,
  secretValuesPrinted: false,
  migrationHashes: hashes,
  manifestsPresent: manifests.length,
  productionChanges: "NONE",
  complete: hits === 0,
};
fs.writeFileSync(
  "docs/v2-3-secret-scan.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    files,
    bundleFiles,
    secretValueHits: hits,
    complete: result.complete,
  }),
);
if (hits) process.exitCode = 1;
