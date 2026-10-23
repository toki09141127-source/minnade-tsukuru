// Requires explicit approval for this exact V2.4 Preview and temporary access method before execution.
/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs = require("fs"),
  cp = require("child_process");
const d = JSON.parse(fs.readFileSync("docs/v2-4-preview-deployment.json")),
  cli = fs.readFileSync(".staging-private/vercel-cli-path.txt", "utf8").trim();
if (
  d.target !== "preview" ||
  d.project !== "minnade-tsukuru-staging" ||
  d.url !==
    "https://minnade-tsukuru-staging-4wqvksxt4-sonetokiyas-projects.vercel.app"
)
  throw Error("SCOPE");
const h = ".staging-private/v24-preview-access-headers.txt",
  b = ".staging-private/v24-preview-login.html";
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
    h,
    "--output",
    b,
  ],
  { encoding: "utf8", windowsHide: true, timeout: 30000 },
);
if (r.status !== 0) throw Error("CLI_AUTHENTICATED_PREVIEW_FAILED");
const headers = fs.readFileSync(h, "utf8"),
  matches = [
    ...headers.matchAll(/^set-cookie:\s*([^=;\s]+)=([^;\r\n]*)([^\r\n]*)/gim),
  ];
const cookies = matches
  .filter((m) => m[1] === "_vercel_jwt")
  .map((m) => ({
    name: m[1],
    value: m[2],
    domain: new URL(d.url).hostname,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  }));
if (!cookies.length) throw Error("PREVIEW_AUTH_COOKIE_NOT_RETURNED");
fs.writeFileSync(
  ".staging-private/v24-preview-access.json",
  JSON.stringify({ url: d.url, cookies }),
);
console.log(
  JSON.stringify({
    authorizedCliAccess: true,
    cookieCount: cookies.length,
    appLoginPage: fs.readFileSync(b, "utf8").includes("メールアドレス"),
    valuesPrinted: false,
  }),
);
