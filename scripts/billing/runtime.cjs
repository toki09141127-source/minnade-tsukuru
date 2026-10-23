/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs"),
  cp = require("child_process"),
  net = require("net"),
  assert = require("node:assert/strict");
module.exports = async () => {
  const ctx = require("../staging/safety.cjs").load();
  assert.equal(ctx.ref, "fwqucffxdmbdczspkcyr");
  assert.match(ctx.env.STRIPE_TEST_SECRET_KEY, /^sk_test_/);
  const sock = net.createServer();
  await new Promise((r) => sock.listen(0, "127.0.0.1", r));
  const port = sock.address().port;
  await new Promise((r) => sock.close(r));
  const base = "http://127.0.0.1:" + port,
    cli = JSON.parse(
      fs.readFileSync(".staging-private/v24-stripe-cli.json"),
    ).path;
  let secret = "",
    buffer = "",
    cliExited = false,
    server;
  const listener = cp.spawn(
    cli,
    [
      "listen",
      "--events-from",
      "@self",
      "--events",
      "checkout.session.completed,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed",
      "--forward-to",
      base + "/api/billing/webhook",
      "--latest",
      "--skip-update",
    ],
    {
      env: { ...process.env, STRIPE_API_KEY: ctx.env.STRIPE_TEST_SECRET_KEY },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  listener.on("exit", () => {
    cliExited = true;
  });
  const receive = (chunk) => {
    if (!secret) {
      buffer = (buffer + chunk.toString()).slice(-20000);
      const m = buffer.match(/whsec_[A-Za-z0-9]+/);
      if (m) {
        secret = m[0];
        buffer = "";
      }
    }
  };
  listener.stdout.on("data", receive);
  listener.stderr.on("data", receive);
  const close = async () => {
    if (server) server.kill();
    listener.kill();
    secret = "";
    buffer = "";
  };
  try {
    for (let i = 0; i < 60 && !secret && !cliExited; i++)
      await new Promise((r) => setTimeout(r, 500));
    assert.ok(secret, "STRIPE_LISTENER_READY");
    const env = {
      ...process.env,
      ...ctx.env,
      V2_ENABLED: "true",
      SUPABASE_URL: ctx.url,
      BILLING_ENABLED: "true",
      BILLING_PROVIDER: "stripe_test",
      BILLING_SITE_URL: base,
      STRIPE_TEST_WEBHOOK_SECRET: secret,
      AI_ENABLED: "true",
      AI_PROVIDER: "synthetic",
      OPENAI_API_KEY: "",
      NODE_OPTIONS: "",
      NEXT_TELEMETRY_DISABLED: "1",
      VERCEL_ENV: "development",
    };
    delete env.VERCEL;
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
    server = cp.spawn(
      process.execPath,
      [
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
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(base + "/api/billing?action=plans")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(ready, "LOCAL_APP_READY");
    return { ctx, base, secret, close };
  } catch (e) {
    await close();
    throw e;
  }
};
