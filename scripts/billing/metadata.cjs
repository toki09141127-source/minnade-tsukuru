/* eslint-disable @typescript-eslint/no-require-imports -- Read-only staging metadata verification. */
const fs = require("fs"),
  assert = require("node:assert/strict"),
  crypto = require("crypto");
(async () => {
  let db;
  const out = {
    complete: false,
    checks: [],
    productionChanges: "NONE",
    transaction: "READ ONLY / ROLLBACK",
  };
  const ok = (v, name) => {
    assert.ok(v, name);
    out.checks.push({ name, pass: true });
  };
  try {
    db = (await require("./db.cjs")()).db;
    await db.query("BEGIN READ ONLY");
    const tables = [
      "billing_accounts",
      "billing_events",
      "billing_operations",
      "ai_credit_periods",
      "ai_credit_ledger",
      "room_ai_entitlements",
      "ai_profiles",
    ];
    for (const t of tables) {
      const r = (
        await db.query(
          "SELECT relrowsecurity rls,has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') anon,has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') authenticated,has_table_privilege('service_role',oid,'SELECT,INSERT,UPDATE,DELETE') service FROM pg_class WHERE oid=$1::regclass",
          ["public." + t],
        )
      ).rows[0];
      ok(
        r.rls && !r.anon && !r.authenticated && !r.service,
        t + " RLS and no direct client/service data grants",
      );
    }
    const bad = (
      await db.query(
        "SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='mvp_private' AND (p.proname LIKE 'v24_%' OR p.proname='ai_enqueue') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))",
      )
    ).rows[0].n;
    ok(bad === 0, "private helper RPCs not executable by API roles");
    const flags = (await db.query("SELECT enabled FROM mvp_private.ai_control"))
      .rows[0];
    ok(flags.enabled === false, "global AI flag remains intentionally OFF");
    for (const manifest of [
      "docs/v2-migration-manifest.json",
      "docs/v2-2-staging-migrations.json",
      "docs/v2-4-staging-migrations.json",
    ]) {
      const d = JSON.parse(fs.readFileSync(manifest));
      for (const e of d.files) {
        const actual = crypto
          .createHash("sha256")
          .update(fs.readFileSync("supabase/migrations/" + e.file))
          .digest("hex");
        ok(actual === e.sha256, "applied bytes " + e.file);
      }
    }
    out.complete = true;
  } catch (e) {
    out.failure = {
      code: e.code || "CHECK_FAILED",
      name: /^[a-zA-Z_ ]+$/.test(e.message || "")
        ? e.message
        : "Metadata assertion failed",
    };
    process.exitCode = 1;
  } finally {
    if (db) {
      await db.query("ROLLBACK").catch(() => {});
      await db.end();
    }
    fs.writeFileSync(
      "docs/v2-4-staging-metadata.json",
      JSON.stringify(out, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        complete: out.complete,
        checks: out.checks.length,
        failure: out.failure,
      }),
    );
  }
})();
