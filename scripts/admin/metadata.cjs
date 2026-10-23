/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs"),
  assert = require("node:assert/strict");
(async () => {
  let db;
  const report = {
    complete: false,
    projectRef: "fwqucffxdmbdczspkcyr",
    checks: [],
    productionChanges: "NONE",
  };
  const ok = (v, name) => {
    assert.ok(v, name);
    report.checks.push({ name, pass: true });
  };
  try {
    const x = await require("../billing/db.cjs")();
    db = x.db;
    ok(x.ctx.ref === report.projectRef, "staging target");
    await db.query("BEGIN READ ONLY");
    const tables = [
      "admin_users",
      "admin_audit",
      "admin_notes",
      "admin_subjects",
      "admin_suspensions",
      "admin_room_controls",
      "admin_report_reviews",
      "admin_security_events",
    ];
    for (const table of tables) {
      const r = (
        await db.query(
          "SELECT relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') authenticated,has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') service FROM pg_class c WHERE oid=$1::regclass",
          ["public." + table],
        )
      ).rows[0];
      ok(
        r.relrowsecurity && !r.anon && !r.authenticated && !r.service,
        "RLS and no direct access " + table,
      );
    }
    for (const fn of [
      "v25_admin_read(text,text,jsonb,text,integer,integer,uuid)",
      "v25_admin_action(uuid,text,text,text,integer,jsonb,text,text)",
    ]) {
      const r = (
        await db.query(
          "SELECT has_function_privilege('anon',$1,'EXECUTE') a,has_function_privilege('authenticated',$1,'EXECUTE') u,has_function_privilege('service_role',$1,'EXECUTE') s",
          [fn],
        )
      ).rows[0];
      ok(!r.a && r.u && !r.s, "caller-only admin RPC " + fn.split("(")[0]);
    }
    const state = (await db.query("SELECT mvp_private.v25_flags() flags"))
      .rows[0].flags;
    ok(state.ai === false, "AI remains OFF");
    ok(state.deletion_worker === false, "deletion worker remains OFF");
    const hashes = JSON.parse(
      fs.readFileSync("docs/v2-5-staging-migrations.json"),
    );
    ok(
      hashes.complete && hashes.files.length === 3,
      "three migration manifest entries",
    );
    const f = JSON.parse(fs.readFileSync(".staging-private/v25-e2e.json"));
    ok(f.complete && f.projectRef === x.ctx.ref, "synthetic fixture identity");
    const staff = (
      await db.query(
        "SELECT role,count(*)::int n FROM admin_users WHERE user_id=ANY($1) AND active GROUP BY role",
        [f.users.map((u) => u.id)],
      )
    ).rows;
    ok(
      staff.some((x) => x.role === "owner" && x.n === 1) &&
        staff.some((x) => x.role === "moderator" && x.n === 1),
      "exact synthetic Owner and Moderator",
    );
    await db.query("ROLLBACK");
    report.complete = true;
  } catch (e) {
    report.failure = {
      code: e.code || "CHECK_FAILED",
      message: String(e.message).slice(0, 100),
    };
    process.exitCode = 1;
  } finally {
    if (db) {
      await db.query("ROLLBACK").catch(() => {});
      await db.end();
    }
    fs.writeFileSync(
      "docs/v2-5-staging-metadata.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        complete: report.complete,
        checks: report.checks.length,
        failure: report.failure,
      }),
    );
  }
})();
