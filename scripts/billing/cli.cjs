/* eslint-disable @typescript-eslint/no-require-imports */
// Official Stripe CLI distribution, checksum-verified; no account login or credentials here.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  cp = require("node:child_process");
(async () => {
  const root = path.resolve(".staging-private/stripe-cli");
  fs.mkdirSync(root, { recursive: true });
  const r = await fetch(
    "https://api.github.com/repos/stripe/stripe-cli/releases/latest",
    { headers: { "User-Agent": "minnade-staging-verification" } },
  );
  if (!r.ok) throw Error("RELEASE_UNAVAILABLE");
  const release = await r.json(),
    archive = release.assets.find((a) => /_windows_x86_64\.zip$/.test(a.name)),
    checksum = release.assets.find(
      (a) => a.name === "stripe-windows-checksums.txt",
    );
  if (!archive || !checksum) throw Error("CLI_ASSET_MISSING");
  for (const asset of [archive, checksum])
    if (
      !asset.browser_download_url.startsWith(
        "https://github.com/stripe/stripe-cli/releases/download/",
      )
    )
      throw Error("CLI_ASSET_SCOPE");
  const bytes = Buffer.from(
      await (await fetch(archive.browser_download_url)).arrayBuffer(),
    ),
    sums = await (await fetch(checksum.browser_download_url)).text();
  const actual = crypto.createHash("sha256").update(bytes).digest("hex"),
    expected = sums
      .split(/\r?\n/)
      .find((line) => line.endsWith(archive.name))
      ?.split(/\s+/)[0];
  if (actual !== expected) throw Error("CLI_CHECKSUM");
  const zip = path.join(root, "stripe.zip");
  fs.writeFileSync(zip, bytes);
  const result = cp.spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Expand-Archive -LiteralPath '" +
        zip.replaceAll("'", "''") +
        "' -DestinationPath '" +
        root.replaceAll("'", "''") +
        "' -Force",
    ],
    { windowsHide: true, stdio: "ignore", timeout: 30000 },
  );
  if (result.status !== 0 || !fs.existsSync(path.join(root, "stripe.exe")))
    throw Error("CLI_EXTRACT");
  fs.writeFileSync(
    ".staging-private/v24-stripe-cli.json",
    JSON.stringify({
      path: path.join(root, "stripe.exe"),
      version: release.tag_name,
      sha256: actual,
    }),
  );
  console.log(
    JSON.stringify({
      installed: true,
      version: release.tag_name,
      checksumVerified: true,
    }),
  );
})().catch(() => {
  console.error("STRIPE_CLI_SETUP_FAILED");
  process.exitCode = 1;
});
