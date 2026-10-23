/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
if (fs.existsSync("docs/v2-rc-migration-map.json"))
  throw new Error("LEGACY_INSTALLER_RETIRED_USE_RC_MIGRATION_PLAN");
(async () => {
  let db;
  try {
    const x = await require("../billing/db.cjs")();
    db = x.db;
    if (process.argv[2] !== "apply-staging")
      throw Error("EXPLICIT_STAGING_MODE_REQUIRED");
    const names = [
      "202610230053_admin_foundation.sql",
      "202610230054_admin_write_guards.sql",
      "202610230055_admin_read_models.sql",
    ];
    const report = {
      projectRef: x.ctx.ref,
      files: [],
      productionChanges: "NONE",
      liveBilling: "OFF",
      complete: false,
    };
    const manifest = "docs/v2-5-staging-migrations.json";
    if (fs.existsSync(manifest)) {
      const previous = JSON.parse(fs.readFileSync(manifest));
      assert.equal(previous.projectRef, x.ctx.ref);
      for (const entry of previous.files) {
        assert.equal(
          crypto
            .createHash("sha256")
            .update(fs.readFileSync("supabase/migrations/" + entry.file))
            .digest("hex"),
          entry.sha256,
        );
        if (entry.applied) report.files.push(entry);
      }
    }
    await db.query("SELECT pg_advisory_lock(252500)");
    for (const file of names) {
      if (report.files.some((f) => f.file === file)) continue;
      const sql = fs.readFileSync("supabase/migrations/" + file, "utf8"),
        sha256 = crypto.createHash("sha256").update(sql).digest("hex");
      await db.query(sql);
      report.files.push({ file, sha256, applied: true });
      fs.writeFileSync(manifest, JSON.stringify(report, null, 2) + "\n");
    }
    report.complete = true;
    report.aiEnabled = (
      await db.query("SELECT enabled FROM mvp_private.ai_control")
    ).rows[0].enabled;
    fs.writeFileSync(manifest, JSON.stringify(report, null, 2) + "\n");
    console.log(
      JSON.stringify({
        complete: true,
        migrations: report.files.length,
        projectRef: x.ctx.ref,
        aiEnabled: report.aiEnabled,
      }),
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        complete: false,
        code: e.code ?? "STAGING_MIGRATION_FAILED",
      }),
    );
    process.exitCode = 1;
  } finally {
    if (db) {
      await db.query("ROLLBACK").catch(() => {});
      await db.end();
    }
  }
})();
