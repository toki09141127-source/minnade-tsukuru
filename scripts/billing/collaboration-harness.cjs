/* eslint-disable @typescript-eslint/no-require-imports -- Staging browser harness. */
const fs = require("fs"),
  path = require("path"),
  cp = require("child_process"),
  net = require("net"),
  assert = require("node:assert/strict");
module.exports = async function () {
  const ctx = require("../staging/safety.cjs").load(),
    f = JSON.parse(fs.readFileSync(".staging-private/v24-collaboration.json")),
    ai = JSON.parse(fs.readFileSync(".staging-private/v22-e2e.json")),
    old = JSON.parse(fs.readFileSync(".staging-private/v2-e2e.json"));
  assert.equal(f.projectRef, ctx.ref);
  assert.equal(ai.projectRef, ctx.ref);
  Object.assign(process.env, ctx.env);
  const socket = net.createServer();
  await new Promise((r) => socket.listen(0, "127.0.0.1", r));
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  let base = "http://127.0.0.1:" + port,
    server,
    access = null;
  const hosted = process.argv.includes("--preview");
  if (hosted) {
    const d = JSON.parse(fs.readFileSync("docs/v2-4-preview-deployment.json"));
    assert.equal(d.target, "preview");
    assert.equal(d.project, "minnade-tsukuru-staging");
    assert.equal(d.state, "READY");
    base = d.url;
    access = require("./preview-scope.cjs").access();
    assert.equal(access.url, base);
  } else {
    const env = {
      ...process.env,
      ...ctx.env,
      V2_ENABLED: process.argv.includes("--v2-off") ? "false" : "true",
      AI_ENABLED: "false",
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
    server = cp.spawn(
      process.execPath,
      [
        "--require",
        path.resolve("scripts/staging/web-network.cjs"),
        "node_modules/next/dist/bin/next",
        "start",
        "-H",
        "127.0.0.1",
        "-p",
        String(port),
      ],
      { env, windowsHide: true, stdio: "ignore" },
    );
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/login")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ready) {
      server.kill();
      throw Error("SERVER_READY");
    }
  }
  const { chromium } = require(
      path.join(ctx.env.MVP_TEST_RUNTIME, "node_modules/playwright-core"),
    ),
    browser = await chromium.launch({
      headless: true,
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    });
  const errors = [],
    http500 = [];
  const page = async (user) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    if (access) await context.addCookies(access.cookies);
    const p = await context.newPage();
    p.setDefaultTimeout(40000);
    await p.route("**/*", (r) =>
      [base, ctx.url].includes(new URL(r.request().url()).origin)
        ? r.continue()
        : r.abort(),
    );
    p.on("pageerror", () => errors.push("UNCAUGHT"));
    p.on("response", (r) => {
      if (r.status() >= 500)
        http500.push({ path: new URL(r.url()).pathname, status: r.status() });
    });
    if (user) {
      await p.goto(base + "/login");
      await p.locator("input[type=email]").fill(user.email);
      await p.locator("input[type=password]").fill(user.password);
      await p.getByRole("button", { name: "ログイン", exact: true }).click();
      await p.waitForURL(base + "/");
    }
    return p;
  };
  return {
    ctx,
    f,
    ai,
    old,
    base,
    hosted,
    page,
    browser,
    errors,
    http500,
    close: async () => {
      await browser.close();
      if (server) server.kill();
    },
  };
};
