/* eslint-disable @typescript-eslint/no-require-imports -- Authorized Preview-only signed webhook forwarding. */
const fs = require("fs"),
  http = require("http"),
  cp = require("child_process"),
  assert = require("node:assert/strict");
module.exports = async () => {
  const ctx = require("./preview-scope.cjs").deployment().ctx,
    d = JSON.parse(fs.readFileSync("docs/v2-4-preview-deployment.json")),
    access = require("./preview-scope.cjs").access();
  assert.equal(d.target, "preview");
  assert.equal(d.project, "minnade-tsukuru-staging");
  assert.equal(access.url, d.url);
  assert.equal(d.state, "READY");
  const cookie = access.cookies.map((c) => c.name + "=" + c.value).join("; "),
    counts = { forwarded: 0, success: 0, retryable: 0 };
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/api/billing/webhook") {
      res.writeHead(404).end();
      return;
    }
    try {
      let n = 0,
        buf = [];
      for await (const x of req) {
        n += x.length;
        if (n > 250000) {
          res.writeHead(413).end();
          return;
        }
        buf.push(x);
      }
      const raw = Buffer.concat(buf);
      const event = JSON.parse(raw.toString("utf8"));
      if (event.livemode !== false || Date.parse(access.expiresAt) <= Date.now()) { res.writeHead(403).end(); return; }
      const r = await fetch(d.url + "/api/billing/webhook", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "stripe-signature": String(req.headers["stripe-signature"] || ""),
          "Content-Type": "application/json",
        },
        body: raw,
        signal: AbortSignal.timeout(55000),
        redirect: "error",
      });
      counts.forwarded++;
      if (r.ok) counts.success++;
      else counts.retryable++;
      res.writeHead(r.status).end();
    } catch {
      counts.retryable++;
      res.writeHead(503).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let secret = "",
    buf = "",
    exited = false;
  const cli = cp.spawn(
    JSON.parse(fs.readFileSync(".staging-private/v24-stripe-cli.json")).path,
    [
      "listen",
      "--events-from",
      "@self",
      "--events",
      "checkout.session.completed,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed",
      "--forward-to",
      "http://127.0.0.1:" + server.address().port + "/api/billing/webhook",
      "--latest",
      "--skip-update",
    ],
    {
      env: { ...process.env, STRIPE_API_KEY: ctx.env.STRIPE_TEST_SECRET_KEY },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const receive = (x) => {
    if (!secret) {
      buf = (buf + x).slice(-20000);
      secret = buf.match(/whsec_[A-Za-z0-9]+/)?.[0] || "";
      if (secret) buf = "";
    }
  };
  cli.stdout.on("data", receive);
  cli.stderr.on("data", receive);
  cli.on("exit", () => {
    exited = true;
  });
  const close = async () => {
    cli.kill();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    secret = "";
    buf = "";
  };
  for (let i = 0; i < 60 && !secret && !exited; i++)
    await new Promise((r) => setTimeout(r, 500));
  if (!secret || secret !== ctx.env.STRIPE_TEST_WEBHOOK_SECRET) {
    await close();
    throw Error("PREVIEW_SIGNING_CONFIGURATION");
  }
  return { ctx, base: d.url, cookie, counts, close };
};
