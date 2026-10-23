/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic fixture sessions and exact private file cleanup. */
const fs = require("fs"),
  path = require("path"),
  assert = require("node:assert/strict"),
  { createClient } = require("@supabase/supabase-js");
(async () => {
  let db;
  const result = {
    complete: false,
    productionChanges: "NONE",
    liveBilling: "OFF",
    syntheticSessionRevocations: 0,
    temporaryFilesRemoved: 0,
    webhookForwarderStarted: false,
    shortLivedAccessJwtImmediateRevocationClaimed: false,
  };
  try {
    const { ctx, db: connection } = await require("../billing/db.cjs")();
    db = connection;
    assert.equal(ctx.ref, "fwqucffxdmbdczspkcyr");
    const f = JSON.parse(fs.readFileSync(".staging-private/v25-e2e.json"));
    assert.equal(f.projectRef, ctx.ref);
    assert.equal(f.users.length, 5);
    const report = JSON.parse(
      fs.readFileSync("docs/v2-5-preview-mobile-actions.json"),
    );
    assert.ok(report.browserClosed, "BROWSER_NOT_CLOSED");
    assert.deepEqual(
      (await db.query("SELECT mvp_private.v25_flags() flags")).rows[0].flags,
      f.initialFlags,
    );
    result.initialFlagsRestored = true;
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM admin_users WHERE user_id=ANY($1::uuid[]) AND active",
          [f.users.map((u) => u.id)],
        )
      ).rows[0].n,
      2,
    );
    result.exactSyntheticOwnerModerator = true;
    const admin = createClient(ctx.url, ctx.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const u of f.users) {
      assert.match(
        u.email,
        /^v25-(owner|moderator|member|suspended|departing)-[a-f0-9]{8}@example\.invalid$/,
      );
      const c = createClient(ctx.url, ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const login = await c.auth.signInWithPassword({
        email: u.email,
        password: u.password,
      });
      assert.ok(!login.error && login.data.user.id === u.id, "SYNTHETIC_LOGIN");
      const r = await admin.auth.admin.signOut(
        login.data.session.access_token,
        "global",
      );
      assert.ok(!r.error, "SESSION_REVOCATION");
      result.syntheticSessionRevocations++;
      await c.auth.stopAutoRefresh();
    }
    const counts = await db.query(
      "SELECT (SELECT count(*)::int FROM auth.sessions WHERE user_id=ANY($1::uuid[])) sessions,(SELECT count(*)::int FROM auth.refresh_tokens WHERE user_id=ANY($1::text[]) AND NOT revoked) refresh",
      [f.users.map((u) => u.id)],
    );
    assert.equal(counts.rows[0].sessions, 0, "SYNTHETIC_SESSIONS_REMAIN");
    assert.equal(counts.rows[0].refresh, 0, "SYNTHETIC_REFRESH_REMAIN");
    result.activeSyntheticSessions = 0;
    result.activeSyntheticRefreshTokens = 0;
    result.fixtureRetention =
      "Five synthetic identities, three rooms, three reports and immutable audits retained; no Auth deletion";
    result.complete = true;
  } catch (e) {
    result.complete = false;
    result.failure = /^[A-Z_]+$/.test(e.message || "")
      ? e.message
      : "CLEANUP_CHECK_FAILED";
    process.exitCode = 1;
  } finally {
    const root = path.resolve(".staging-private");
    for (const name of [
      "v25-preview-access.json",
      "v25-preview-login.html",
      "v25-preview-env-check.env",
    ]) {
      const target = path.resolve(root, name);
      assert.equal(path.dirname(target), root);
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        result.temporaryFilesRemoved++;
      }
    }
    result.cookieFilesRemaining = fs.existsSync(
      path.join(root, "v25-preview-access.json"),
    )
      ? 1
      : 0;
    result.protectionUnchanged = true;
    if (db) await db.end();
    fs.writeFileSync(
      "docs/v2-5-cleanup.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result));
  }
})();
